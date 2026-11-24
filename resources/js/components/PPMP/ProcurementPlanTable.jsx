import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../UI/StatusBadge';
import { Plus, Trash2, FileCheck2 } from 'lucide-react';
import { SupportingDocsDropdown } from './SupportingDocsDropdown';
import { supportingDocumentService, procurementModeService } from '../../services/api';
import { CommentableCell } from './CommentableCell';
import { AccountCodeCombobox } from './AccountCodeCombobox';
import { ProgramNameCombobox } from './ProgramNameCombobox';
import { SourceOfFundCombobox } from './SourceOfFundCombobox';

export const formatDescription6Words = (text) => {
    if (!text) return '';

    const lines = text.split('\n');
    return lines.map(line => {
        const words = line.trim().split(/\s+/).filter(Boolean);
        if (words.length <= 6) return line;
        const chunks = [];
        for (let i = 0; i < words.length; i += 6) {
            chunks.push(words.slice(i, i + 6).join(' '));
        }
        return chunks.join('\n');
    }).join('\n');
};

export const formatSingleMonthYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (!str) return '';

    const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const [, year, month] = isoMatch;
        return `${parseInt(month, 10)}/${year}`;
    }

    const myMatch = str.match(/^(\d{1,2})\/(\d{4})/);
    if (myMatch) {
        const [, month, year] = myMatch;
        return `${parseInt(month, 10)}/${year}`;
    }
    return str;
};

export const formatMonthYear = (val) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (!str) return '—';

    if (str.includes(' - ') || str.includes(' to ')) {
        const parts = str.includes(' - ') ? str.split(' - ') : str.split(' to ');
        const start = formatSingleMonthYear(parts[0]);
        const end = formatSingleMonthYear(parts[1]);
        if (start && end) {
            return `${start} - ${end}`;
        }
        return start || end || '—';
    }

    const formatted = formatSingleMonthYear(str);
    return formatted || str;
};

export const toSingleMonthInputValue = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const [, year, month] = isoMatch;
        return `${year}-${month.padStart(2, '0')}`;
    }
    const myMatch = str.match(/^(\d{1,2})\/(\d{4})/);
    if (myMatch) {
        const [, month, year] = myMatch;
        return `${year}-${month.padStart(2, '0')}`;
    }
    return '';
};

export const parseMonthRangeValue = (val) => {
    if (!val) return { start: '', end: '' };
    const str = String(val).trim();
    if (str.includes(' - ')) {
        const parts = str.split(' - ');
        return {
            start: toSingleMonthInputValue(parts[0]),
            end: toSingleMonthInputValue(parts[1])
        };
    }
    if (str.includes(' to ')) {
        const parts = str.split(' to ');
        return {
            start: toSingleMonthInputValue(parts[0]),
            end: toSingleMonthInputValue(parts[1])
        };
    }
    return {
        start: toSingleMonthInputValue(str),
        end: ''
    };
};

export const combineMonthRangeValue = (startVal, endVal) => {
    const startFormatted = formatSingleMonthYear(startVal);
    const endFormatted = formatSingleMonthYear(endVal);
    if (startFormatted && endFormatted) {
        return `${startFormatted} - ${endFormatted}`;
    }
    return startFormatted || endFormatted || '';
};

export const toMonthInputValue = (val) => {
    return parseMonthRangeValue(val).start;
};

export const MonthRangeInput = ({ value, onChange, className = "" }) => {
    const { start, end } = parseMonthRangeValue(value);
    const [hasRange, setHasRange] = React.useState(Boolean(end));

    React.useEffect(() => {
        if (end) {
            setHasRange(true);
        }
    }, [end]);

    const handleStartChange = (newStart) => {
        const combined = combineMonthRangeValue(newStart, hasRange ? end : '');
        onChange(combined);
    };

    const handleEndChange = (newEnd) => {
        const combined = combineMonthRangeValue(start, newEnd);
        onChange(combined);
    };

    const toggleRange = () => {
        if (hasRange) {

            setHasRange(false);
            onChange(combineMonthRangeValue(start, ''));
        } else {

            setHasRange(true);
        }
    };

    return (
        <div className={`flex flex-col items-center gap-1 min-w-[125px] ${className}`}>
            <input
                type="month"
                value={start || ''}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full text-[11px] p-1 border border-slate-300 rounded text-center bg-white shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                title="Select month"
            />

            {hasRange ? (
                <div className="w-full flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 select-none">-</span>
                    <input
                        type="month"
                        value={end || ''}
                        onChange={(e) => handleEndChange(e.target.value)}
                        className="w-full text-[11px] p-1 border border-blue-300 bg-blue-50/50 rounded text-center shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        title="Select end month (optional range)"
                    />
                    <button
                        type="button"
                        onClick={toggleRange}
                        className="text-[10px] text-slate-400 hover:text-rose-600 px-1 py-0.5 rounded transition"
                        title="Remove range (single month only)"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={toggleRange}
                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition select-none"
                    title="Add optional end month for range (e.g. 1/2026 - 2/2026)"
                >
                    + range
                </button>
            )}
        </div>
    );
};

const DEFAULT_DOCUMENTS = [];

export const ProcurementPlanTable = ({
    items = [],
    isEditable = false,
    onAddItem,
    onAddRetention = null,
    onRemoveItem,
    onUpdateItem,
    onUpdateCellValue = null,
    totalBudget = 0,
    accountCode = '',
    onAccountCodeChange,
    accountCodeId = null,
    onAccountCodeIdChange = null,
    accountCodes = null,
    programName = '',
    onProgramNameChange,
    programNameId = null,
    onProgramNameIdChange = null,
    programNames = null,
    fiscalYear = null,
    fundSources = null,
    workflowRoute = null,
    deliveryPeriod = '',
    placeOfDelivery = '',
    paymentMethod = '',
    warrantyAndOtherTerms = '',
    supportingDocuments = DEFAULT_DOCUMENTS,
    procurementModes = null,

    cellComments = [],
    changeLogs = [],
    canComment = false,
    canComply = false,
    currentUser = null,
    onAddCellComment = null,
    onDeleteCellComment = null,
    onComplyCellComment = null,
    onUncomplyCellComment = null,
}) => {
    const [activeCellKey, setActiveCellKey] = useState(null);
    const [showProgramInput, setShowProgramInput] = useState(Boolean(programName && String(programName).trim()));
    const [showRetentionPanel, setShowRetentionPanel] = useState(false);
    const [retentionPctInput, setRetentionPctInput] = useState('10');
    const [autoDeductRetention, setAutoDeductRetention] = useState(true);
    const [docsList, setDocsList] = useState(supportingDocuments);
    const [modesList, setModesList] = useState(Array.isArray(procurementModes) && procurementModes.length > 0 ? procurementModes : []);

    useEffect(() => {
        if (Array.isArray(procurementModes) && procurementModes.length > 0) {
            setModesList(procurementModes);
            return;
        }

        let isMounted = true;
        const loadModes = () => {
            procurementModeService.getAll({ active_only: 1 })
                .then(res => {
                    if (isMounted && Array.isArray(res.data)) {
                        setModesList(res.data);
                    }
                })
                .catch(() => {});
        };

        loadModes();

        const handleModesChanged = () => {
            if (isMounted) loadModes();
        };
        window.addEventListener('procurement-modes:changed', handleModesChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('procurement-modes:changed', handleModesChanged);
        };
    }, [procurementModes]);

    useEffect(() => {
        if (supportingDocuments && supportingDocuments.length > 0) {
            setDocsList(supportingDocuments);
            return;
        }

        if (!isEditable) {
            return;
        }

        let isMounted = true;
        const loadDocs = () => {
            supportingDocumentService.getAll({ active_only: 1 })
                .then(res => {
                    if (isMounted && Array.isArray(res.data)) {
                        setDocsList(res.data);
                    }
                })
                .catch(() => {});
        };

        loadDocs();

        const handleDocsChanged = () => {
            if (isMounted) loadDocs();
        };
        window.addEventListener('supporting-documents:changed', handleDocsChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('supporting-documents:changed', handleDocsChanged);
        };
    }, [isEditable, supportingDocuments]);

    useEffect(() => {
        if (programName && String(programName).trim()) {
            setShowProgramInput(true);
        }
    }, [programName]);

    const getCellUpdateHandler = (fieldKey, fieldLabel, item, realIdx) => {
        if (onUpdateItem) {
            return (newVal) => {
                if (fieldKey === 'pre_proc_conference') {
                    onUpdateItem(realIdx, fieldKey, newVal === 'YES' || newVal === true || newVal === '1');
                } else if (fieldKey === 'estimated_budget') {
                    const cleanNum = parseFloat(String(newVal).replace(/[^0-9.-]+/g, ''));
                    onUpdateItem(realIdx, fieldKey, isNaN(cleanNum) ? 0 : cleanNum);
                } else {
                    onUpdateItem(realIdx, fieldKey, newVal);
                }
            };
        }
        if (onUpdateCellValue) {
            return (newVal) => onUpdateCellValue(fieldKey, newVal, item?.id, realIdx + 1, fieldLabel);
        }
        return null;
    };

    return (
        <div className="mt-4">
            <div className="overflow-x-auto border border-slate-900 shadow-sm bg-white rounded-t-lg">
                <table className="w-full text-left text-xs border-collapse print-table">
                    <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                        <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold divide-x divide-slate-400 text-center text-[11px] leading-snug">
                            <th className="p-2.5 min-w-[300px]">
                                General Description and Objective of the<br />
                                Project to be Procured
                            </th>
                            <th className="p-2.5 min-w-[140px]">
                                Type of the Project to be<br />
                                Procured (whether Goods,<br />
                                Infrastructure and<br />
                                Consulting Services)
                            </th>
                            <th className="p-2.5 min-w-[130px]">
                                Quantity and Size of the<br />
                                Project to be Procured
                            </th>
                            <th className="p-2.5 min-w-[175px]">
                                Recommended Mode of<br />
                                Procurement
                            </th>
                            <th className="p-2.5 min-w-[115px]">
                                Pre-Procurement<br />
                                Conference, if applicable<br />
                                (Yes/No)
                            </th>
                            <th className="p-2.5 min-w-[145px]">
                                Start of Procurement<br />
                                Activity
                            </th>
                            <th className="p-2.5 min-w-[145px]">
                                End of Procurement<br />
                                Activity
                            </th>
                            <th className="p-2.5 min-w-[145px]">
                                Expected Delivery/<br />
                                Implementation Period
                            </th>
                            <th className="p-2.5 min-w-[185px]">
                                Source of Funds
                            </th>
                            <th className="p-2.5 min-w-[145px] text-right">
                                Estimated Budget /<br />
                                Authorized Budgetary<br />
                                Allocation (PhP)
                            </th>
                            <th className="p-2.5 min-w-[200px]">
                                ATTACHED SUPPORTING<br />
                                DOCUMENTS
                            </th>
                            <th className="p-2.5 min-w-[150px]">
                                REMARKS
                            </th>
                            {isEditable && <th className="p-2.5 min-w-[68px] w-16 no-print">Action</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">

                        <tr className="bg-slate-50 font-bold border-b border-slate-300 divide-x divide-slate-300">
                            <CommentableCell
                                itemId={null}
                                itemNo={null}
                                fieldKey="program_name"
                                fieldLabel="Category / Program Name & Account Code"
                                cellValue={`${programName ? programName + ' • ' : ''}${accountCode || items.find(i => i.is_header)?.description || ''}`}
                                comments={cellComments}
                                changeLogs={changeLogs}
                                canComment={canComment}
                                canComply={canComply}
                                currentUser={currentUser}
                                activeCellKey={activeCellKey}
                                setActiveCellKey={setActiveCellKey}
                                onAddCellComment={onAddCellComment}
                                onDeleteCellComment={onDeleteCellComment}
                                onComplyCellComment={onComplyCellComment}
                                onUncomplyCellComment={onUncomplyCellComment}
                                onUpdateCellValue={(newVal) => {
                                    if (onUpdateCellValue) {
                                        onUpdateCellValue('program_name', newVal, null, null, 'Category / Program Name & Account Code');
                                    }
                                    if (newVal.includes(' • ')) {
                                        const [pName, ...rest] = newVal.split(' • ');
                                        const aCode = rest.join(' • ');
                                        if (onProgramNameChange) onProgramNameChange(pName.trim());
                                        if (onAccountCodeChange) onAccountCodeChange(aCode.trim());
                                    } else {
                                        if (onAccountCodeChange) onAccountCodeChange(newVal.trim());
                                    }
                                }}
                                className="p-2 font-bold uppercase tracking-wide text-slate-900 bg-slate-50"
                            >
                                {isEditable ? (
                                    <div className="flex flex-col gap-2">

                                        <ProgramNameCombobox
                                            value={programName || ''}
                                            selectedId={programNameId}
                                            onSelectId={onProgramNameIdChange}
                                            programNames={programNames}
                                            onChange={(newVal, record) => {
                                                if (onProgramNameChange) onProgramNameChange(newVal);
                                                if (onProgramNameIdChange) onProgramNameIdChange(record ? record.id : null);
                                            }}
                                            placeholder="Search Program Name..."
                                        />

                                        <AccountCodeCombobox
                                            value={(accountCode !== undefined && accountCode !== null && onAccountCodeChange ? accountCode : (items.find(i => i.is_header)?.description || '')) || ''}
                                            selectedId={accountCodeId}
                                            onSelectId={onAccountCodeIdChange}
                                            accountCodes={accountCodes}
                                            onChange={(newVal, record) => {
                                                if (onAccountCodeChange) {
                                                    onAccountCodeChange(newVal);
                                                }
                                                if (onAccountCodeIdChange && record) {
                                                    onAccountCodeIdChange(record.id);
                                                }
                                                const headerIdx = items.findIndex(i => i.is_header);
                                                if (headerIdx >= 0) {
                                                    onUpdateItem(headerIdx, 'description', newVal);
                                                } else if (!onAccountCodeChange) {
                                                    onAddItem({ is_header: true, description: newVal });
                                                }
                                            }}
                                            placeholder="Search Account Code (e.g. 5-02-03-220 or Office Supplies)..."
                                        />
                                    </div>
                                ) : (
                                    <div className="font-extrabold text-slate-900 text-[11px] text-center whitespace-pre-wrap leading-tight py-1">
                                        {programName && (
                                            <div className="font-bold text-blue-900 text-[11px] underline mb-1 whitespace-pre-wrap">
                                                {formatDescription6Words(programName)}
                                            </div>
                                        )}
                                        {formatDescription6Words(accountCode || items.find(i => i.is_header)?.description || '')}
                                    </div>
                                )}
                            </CommentableCell>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            {isEditable && <td className="p-2 no-print"></td>}
                        </tr>

                        {items.filter(i => !i.is_header).length === 0 ? (
                            <tr>
                                <td colSpan={isEditable ? 13 : 12} className="p-8 text-center text-slate-400 italic">
                                    No procurement items listed in this PPMP. Click below to add an item.
                                </td>
                            </tr>
                        ) : (
                            items.filter(i => !i.is_header).map((item, index) => {
                                const realIdx = items.findIndex(i => i === item);
                                const isRetentionRow = Boolean(item.is_retention);
                                return (
                                <tr key={item.id || index} className={`divide-x divide-slate-200 transition-colors ${isRetentionRow ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>

                                    <CommentableCell
                                        itemId={item.id}
                                        itemNo={realIdx + 1}
                                        fieldKey="description"
                                        fieldLabel="General Description and Objective"
                                        cellValue={item.description}
                                        comments={cellComments}
                                        changeLogs={changeLogs}
                                        canComment={canComment}
                                        canComply={canComply}
                                        currentUser={currentUser}
                                        activeCellKey={activeCellKey}
                                        setActiveCellKey={setActiveCellKey}
                                        onAddCellComment={onAddCellComment}
                                        onDeleteCellComment={onDeleteCellComment}
                                        onComplyCellComment={onComplyCellComment}
                                        onUncomplyCellComment={onUncomplyCellComment}
                                        className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('description', 'General Description and Objective', item, realIdx)}>
                                        {isRetentionRow && (
                                            <div className="mb-1.5 flex items-center justify-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-200/90 text-amber-950 border border-amber-400">
                                                    Retention{item.retention_percentage ? ` (${parseFloat(item.retention_percentage)}%)` : ''} &bull; Optional Spec
                                                </span>
                                            </div>
                                        )}
                                        {isEditable ? (
                                            <textarea
                                                value={item.description || ''}
                                                onChange={(e) => onUpdateItem(realIdx, 'description', e.target.value)}
                                                onBlur={(e) => onUpdateItem(realIdx, 'description', formatDescription6Words(e.target.value))}
                                                placeholder=""
                                                className="w-full text-xs p-2 font-semibold text-center uppercase tracking-wide border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none leading-relaxed transition-all resize-y placeholder:normal-case placeholder:font-normal placeholder:italic placeholder:text-slate-400"
                                                rows={4}
                                            />
                                        ) : (
                                            <div className="font-bold text-slate-900 text-xs text-center uppercase tracking-wide whitespace-pre-wrap leading-relaxed py-1">
                                                {formatDescription6Words(item.description)}
                                            </div>
                                        )}
                                    </CommentableCell>

                                    {!item.is_header && (
                                        <>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="project_type"
                                                fieldLabel="Type of Project"
                                                cellValue={item.project_type || 'Goods'}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('project_type', 'Type of Project', item, realIdx)}>
                                                {isEditable ? (
                                                    <select
                                                        value={item.project_type || 'Goods'}
                                                        onChange={(e) => onUpdateItem(realIdx, 'project_type', e.target.value)}
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                                                    >
                                                        <option value="Goods">Goods</option>
                                                        <option value="Infrastructure Projects">Infrastructure Projects</option>
                                                        <option value="Consulting Services">Consulting Services</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-slate-800">{item.project_type || 'Goods'}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="quantity_size"
                                                fieldLabel="Quantity and Size"
                                                cellValue={item.quantity_size}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('quantity_size', 'Quantity and Size', item, realIdx)}>
                                                {isEditable ? (
                                                    <textarea
                                                        value={item.quantity_size || ''}
                                                        onChange={(e) => onUpdateItem(realIdx, 'quantity_size', e.target.value)}
                                                        placeholder=""
                                                        rows={3}
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y leading-tight"
                                                    />
                                                ) : (
                                                    <span className="whitespace-pre-wrap">{item.quantity_size || '—'}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="procurement_mode"
                                                fieldLabel="Recommended Mode of Procurement"
                                                cellValue={item.procurement_mode}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('procurement_mode', 'Recommended Mode of Procurement', item, realIdx)}>
                                                {isEditable ? (
                                                    <select
                                                        value={item.procurement_mode || (modesList[0]?.name || 'Competitive Bidding (RA 12009)')}
                                                        onChange={(e) => onUpdateItem(realIdx, 'procurement_mode', e.target.value)}
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium text-slate-800"
                                                    >

                                                        {item.procurement_mode && !modesList.some((m) => m.name === item.procurement_mode) && (
                                                            <option value={item.procurement_mode}>
                                                                {item.procurement_mode} (Inactive)
                                                            </option>
                                                        )}
                                                        {modesList.map((m) => (
                                                            <option key={m.id || m.name} value={m.name}>
                                                                {m.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="font-medium text-slate-800">{item.procurement_mode}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="pre_proc_conference"
                                                fieldLabel="Pre-Procurement Conference"
                                                cellValue={item.pre_proc_conference ? 'YES' : 'NO'}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 text-center align-middle"

                                        onUpdateCellValue={getCellUpdateHandler('pre_proc_conference', 'Pre-Procurement Conference', item, realIdx)}>
                                                {isEditable ? (
                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.pre_proc_conference}
                                                            onChange={(e) => onUpdateItem(realIdx, 'pre_proc_conference', e.target.checked)}
                                                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                                            title={(parseFloat(item.estimated_budget) || 0) >= 5000000 ? "Pre-Procurement Conference (Mandatory for Estimated Budget ₱5,000,000 and above)" : "Pre-Procurement Conference, if applicable (Yes/No)"}
                                                        />
                                                        {(parseFloat(item.estimated_budget) || 0) >= 5000000 && (
                                                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded leading-tight" title="Mandatory for ₱5M+">
                                                                ≥ 5M
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${item.pre_proc_conference ? 'bg-amber-100 text-amber-800' : 'text-slate-500'}`}>
                                                        {item.pre_proc_conference ? 'YES' : 'NO'}
                                                    </span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="start_date"
                                                fieldLabel="Start of Procurement Activity"
                                                cellValue={item.start_date}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 text-center align-top"

                                        onUpdateCellValue={getCellUpdateHandler('start_date', 'Start of Procurement Activity', item, realIdx)}>
                                                {isEditable ? (
                                                    <MonthRangeInput
                                                        value={item.start_date}
                                                        onChange={(val) => onUpdateItem(realIdx, 'start_date', val)}
                                                    />
                                                ) : (
                                                    <span>{formatMonthYear(item.start_date)}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="end_date"
                                                fieldLabel="End of Procurement Activity"
                                                cellValue={item.end_date}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 text-center align-top"

                                        onUpdateCellValue={getCellUpdateHandler('end_date', 'End of Procurement Activity', item, realIdx)}>
                                                {isEditable ? (
                                                    <MonthRangeInput
                                                        value={item.end_date}
                                                        onChange={(val) => onUpdateItem(realIdx, 'end_date', val)}
                                                    />
                                                ) : (
                                                    <span>{formatMonthYear(item.end_date)}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="delivery_period"
                                                fieldLabel="Expected Delivery / Implementation Period"
                                                cellValue={item.delivery_period}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 text-center align-top"

                                        onUpdateCellValue={getCellUpdateHandler('delivery_period', 'Expected Delivery / Implementation Period', item, realIdx)}>
                                                {isEditable ? (
                                                    <MonthRangeInput
                                                        value={item.delivery_period}
                                                        onChange={(val) => onUpdateItem(realIdx, 'delivery_period', val)}
                                                    />
                                                ) : (
                                                    <span>{formatMonthYear(item.delivery_period)}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="source_of_fund"
                                                fieldLabel="Source of Funds"
                                                cellValue={item.source_of_fund}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('source_of_fund', 'Source of Funds', item, realIdx)}>
                                                {isEditable ? (
                                                    <SourceOfFundCombobox
                                                        value={item.source_of_fund || ''}
                                                        onChange={(val) => onUpdateItem(realIdx, 'source_of_fund', val)}
                                                        selectedId={item.fund_source_id}
                                                        onSelectId={(id) => onUpdateItem(realIdx, 'fund_source_id', id)}
                                                        fiscalYear={fiscalYear}
                                                        fundSources={fundSources}
                                                        workflowRoute={workflowRoute}
                                                        placeholder="Select source of funds..."
                                                    />
                                                ) : (
                                                    <span className="whitespace-pre-wrap">{item.source_of_fund || '—'}</span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="estimated_budget"
                                                fieldLabel="Estimated Budget / Authorized Allocation"
                                                cellValue={formatCurrency(item.estimated_budget)}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 text-right align-top"

                                        onUpdateCellValue={getCellUpdateHandler('estimated_budget', 'Estimated Budget / Authorized Allocation', item, realIdx)}>
                                                {isEditable ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={item.estimated_budget ?? ''}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            onUpdateItem(realIdx, 'estimated_budget', raw === '' ? '' : (parseFloat(raw) || 0));
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded text-right font-mono font-bold text-blue-900"
                                                    />
                                                ) : (
                                                    <span className="font-mono font-bold text-slate-900">
                                                        {formatCurrency(item.estimated_budget)}
                                                    </span>
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="supporting_docs_text"
                                                fieldLabel="Attached Supporting Documents"
                                                cellValue={item.supporting_docs_text}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top min-w-[200px]"

                                        onUpdateCellValue={getCellUpdateHandler('supporting_docs_text', 'Attached Supporting Documents', item, realIdx)}>
                                                {isEditable ? (
                                                    <SupportingDocsDropdown
                                                        value={item.supporting_docs_text || ''}
                                                        onChange={(val) => onUpdateItem(realIdx, 'supporting_docs_text', val)}
                                                        documents={docsList}
                                                        placeholder="Select supporting docs..."
                                                    />
                                                ) : (
                                                    item.supporting_docs_text ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.supporting_docs_text.split(',').map((doc, dIdx) => {
                                                                const cleanDoc = doc.trim();
                                                                if (!cleanDoc) return null;
                                                                return (
                                                                    <span
                                                                        key={dIdx}
                                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200"
                                                                    >
                                                                        <FileCheck2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                                                        <span>{cleanDoc}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">—</span>
                                                    )
                                                )}
                                            </CommentableCell>

                                            <CommentableCell
                                                itemId={item.id}
                                                itemNo={realIdx + 1}
                                                fieldKey="remarks"
                                                fieldLabel="Remarks"
                                                cellValue={item.remarks}
                                                comments={cellComments}
                                        changeLogs={changeLogs}
                                                canComment={canComment}
                                                canComply={canComply}
                                                currentUser={currentUser}
                                                activeCellKey={activeCellKey}
                                                setActiveCellKey={setActiveCellKey}
                                                onAddCellComment={onAddCellComment}
                                                onDeleteCellComment={onDeleteCellComment}
                                                onComplyCellComment={onComplyCellComment}
                                                onUncomplyCellComment={onUncomplyCellComment}
                                                className="p-2 align-top"

                                        onUpdateCellValue={getCellUpdateHandler('remarks', 'Remarks', item, realIdx)}>
                                                {isEditable ? (
                                                    <textarea
                                                        value={item.remarks || ''}
                                                        onChange={(e) => onUpdateItem(realIdx, 'remarks', e.target.value)}
                                                        placeholder=""
                                                        rows={3}
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y leading-tight"
                                                    />
                                                ) : (
                                                    <span className="text-slate-600 whitespace-pre-wrap">{item.remarks || '—'}</span>
                                                )}
                                            </CommentableCell>
                                        </>
                                    )}

                                    {isEditable && (
                                        <td className="p-2 text-center no-print">
                                            <button
                                                type="button"
                                                onClick={() => onRemoveItem(realIdx)}
                                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                                                title="Delete row"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                            })
                        )}

                        {(() => {
                            const retentionTotal = items
                                .filter(i => !i.is_header && i.is_retention)
                                .reduce((sum, i) => sum + (parseFloat(i.estimated_budget) || 0), 0);
                            const procuredTotal = Math.max(0, Math.round((totalBudget - retentionTotal) * 100) / 100);
                            return (
                                <tr className="border-t-2 border-slate-800 font-semibold text-xs bg-slate-50 divide-x divide-slate-300">
                                    <td colSpan={9} className="p-2.5 text-right font-bold text-slate-700 uppercase tracking-wider align-middle">
                                        <div>Total Estimated Budget:</div>
                                        {retentionTotal > 0 && (
                                            <div className="mt-1 space-y-0.5 text-[11px] font-semibold normal-case">
                                                <div className="text-amber-700">Less Retention: -{formatCurrency(retentionTotal)}</div>
                                                <div className="text-emerald-700 font-extrabold">Net Budget To Be Procured: {formatCurrency(procuredTotal)}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td colSpan={isEditable ? 4 : 3} className="p-3 text-center align-middle bg-blue-900 text-white font-bold">
                                        <div className="text-[11px] uppercase tracking-wider text-slate-200">TOTAL BUDGET:</div>
                                        <div className="font-mono text-base font-extrabold text-amber-300 mt-0.5">
                                            {formatCurrency(totalBudget)}
                                        </div>
                                        {retentionTotal > 0 && (
                                            <div className="text-[10px] font-mono text-emerald-300 mt-0.5">
                                                Procured: {formatCurrency(procuredTotal)}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })()}
                    </tbody>
                </table>
            </div>

            {isEditable && (
                <div className="mt-3 space-y-2.5 no-print">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={onAddItem}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Add Procurement Item Row
                        </button>
                        {onAddRetention && (
                            <button
                                type="button"
                                onClick={() => setShowRetentionPanel(prev => !prev)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-md text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
                                title="Add a Retention row and optionally deduct the retention percentage from your total procurement budget"
                            >
                                <Plus className="w-4 h-4" />
                                Add Procurement Item Row (Retention)
                            </button>
                        )}
                    </div>

                    {onAddRetention && showRetentionPanel && (() => {
                        const regularTotal = items
                            .filter(i => !i.is_header && !i.is_retention)
                            .reduce((sum, i) => sum + (parseFloat(i.estimated_budget) || 0), 0);
                        const pctVal = Math.max(0, Math.min(100, parseFloat(retentionPctInput) || 0));
                        const previewRetention = autoDeductRetention && regularTotal > 0
                            ? Math.round(regularTotal * (pctVal / 100) * 100) / 100
                            : 0;
                        const previewProcured = Math.max(0, Math.round((regularTotal - previewRetention) * 100) / 100);

                        return (
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                <div className="space-y-1.5 flex-1">
                                    <div className="font-extrabold text-amber-950 uppercase tracking-wide text-[11px]">
                                        Add Retention Row &amp; Automatic Budget Deduction
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <label className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                                            <span>Retention %:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={retentionPctInput}
                                                onChange={(e) => setRetentionPctInput(e.target.value)}
                                                className="w-20 px-2 py-1 bg-white border border-amber-400 rounded text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            />
                                            <span>%</span>
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 text-amber-900 font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoDeductRetention}
                                                onChange={(e) => setAutoDeductRetention(e.target.checked)}
                                                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                            />
                                            <span>Deduct {pctVal}% from current procurement items</span>
                                        </label>
                                    </div>
                                    {regularTotal > 0 && autoDeductRetention && (
                                        <div className="text-[11px] font-mono text-amber-950 bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-200 inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span>Gross: <strong>{formatCurrency(regularTotal)}</strong></span>
                                            <span className="text-amber-700">Retention ({pctVal}%): <strong>-{formatCurrency(previewRetention)}</strong></span>
                                            <span className="text-emerald-700">To Be Procured: <strong>{formatCurrency(previewProcured)}</strong></span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowRetentionPanel(false)}
                                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onAddRetention({
                                                percentage: pctVal,
                                                deductFromItems: autoDeductRetention,
                                            });
                                            setShowRetentionPanel(false);
                                        }}
                                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                                    >
                                        Apply &amp; Add Retention Row
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
