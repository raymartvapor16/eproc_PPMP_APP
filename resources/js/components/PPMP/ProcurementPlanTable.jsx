import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../UI/StatusBadge';
import { Plus, Trash2, FileCheck2 } from 'lucide-react';
import { SupportingDocsDropdown } from './SupportingDocsDropdown';
import { supportingDocumentService, procurementModeService } from '../../services/api';
import { CommentableCell } from './CommentableCell';
import { AccountCodeCombobox } from './AccountCodeCombobox';
import { ProgramNameCombobox } from './ProgramNameCombobox';
import { SourceOfFundCombobox } from './SourceOfFundCombobox';

/**
 * Automatically wraps long text so each line has at most 6 words,
 * matching government PPMP presentation standards.
 */
export const formatDescription6Words = (text) => {
    if (!text) return '';
    // If the user already added manual line breaks, preserve user's line structure but ensure each line respects max 6 words
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

/**
 * Formats a month or date string (e.g. "2026-01", "2026-01 - 2026-02", "1/2026", "1/2026 - 2/2026") into "M/YYYY" or "M/YYYY - M/YYYY" format.
 */
export const formatSingleMonthYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (!str) return '';
    // Match YYYY-MM or YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const [, year, month] = isoMatch;
        return `${parseInt(month, 10)}/${year}`;
    }
    // Match MM/YYYY or M/YYYY
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

    // Check if it's a range (separated by ' - ' or ' to ' or ',')
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

/**
 * Normalizes input value for single month <input type="month"> (YYYY-MM).
 */
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

/**
 * Splits a stored date value (which could be single "1/2026" or range "1/2026 - 2/2026")
 * into { startMonth: 'YYYY-MM', endMonth: 'YYYY-MM' } for inputs.
 */
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

/**
 * Combines startMonth (YYYY-MM) and optional endMonth (YYYY-MM) into standard string representation e.g. "1/2026" or "1/2026 - 2/2026".
 */
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

/**
 * Compact, clean Month / Month Range input component:
 * Allows user to pick a primary month (e.g. 1/2026), with an optional secondary month (e.g. 2/2026)
 * to form a range like "1/2026 - 2/2026", or just keep single "1/2026".
 */
export const MonthRangeInput = ({ value, onChange, className = "" }) => {
    const { start, end } = parseMonthRangeValue(value);
    const [hasRange, setHasRange] = React.useState(Boolean(end));

    // Keep internal range toggle synced if value prop changes
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
            // Remove range, keep only start
            setHasRange(false);
            onChange(combineMonthRangeValue(start, ''));
        } else {
            // Enable range
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
    // Google Sheets style Cell Comments props
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

        // Only editable mode requires the list of supporting documents for dropdown selection
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
                        <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold divide-x divide-slate-400 text-center text-[11px] leading-tight">
                            <th className="p-2 min-w-[320px]">
                                General Description and Objective of the<br />
                                Project to be Procured
                            </th>
                            <th className="p-2 min-w-[100px] w-28">
                                Type of the Project to be<br />
                                Procured (whether Goods, Infrastructure and<br />
                                Consulting Services)
                            </th>
                            <th className="p-2 min-w-[110px]">
                                Quantity and Size of the Project<br />
                                to be Procured
                            </th>
                            <th className="p-2 min-w-[120px]">
                                Recommended Mode of<br />
                                Procurement
                            </th>
                            <th className="p-2 w-28">
                                Pre-Procurement Conference, if<br />
                                applicable (Yes/No)
                            </th>
                            <th className="p-2 min-w-[100px]">
                                Start of Procurement<br />
                                Activity
                            </th>
                            <th className="p-2 min-w-[100px]">
                                End of Procurement<br />
                                Activity
                            </th>
                            <th className="p-2 min-w-[110px]">
                                Expected Delivery/<br />
                                Implementation Period
                            </th>
                            <th className="p-2 min-w-[90px]">
                                Source of Funds
                            </th>
                            <th className="p-2 min-w-[130px] text-right">
                                Estimated Budget / Authorized<br />
                                Budgetary Allocation (PhP)
                            </th>
                            <th className="p-2 min-w-[170px]">
                                ATTACHED SUPPORTING<br />
                                DOCUMENTS
                            </th>
                            <th className="p-2 min-w-[90px]">
                                REMARKS
                            </th>
                            {isEditable && <th className="p-2 w-12 no-print">Action</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                        {/* 2nd Row after the header row: Category / Account Title (e.g. Representation Expenses (5-02-99-030)) */}
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
                                        {/* Searchable Program Name Dropdown */}
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
                                return (
                                <tr key={item.id || index} className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors">
                                    {/* Description & Objective */}
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
                                        className="align-top"
                                    
                                        onUpdateCellValue={getCellUpdateHandler('description', 'General Description and Objective', item, realIdx)}>
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
                                            {/* Type of Project */}
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
                                            
                                        onUpdateCellValue={getCellUpdateHandler('project_type', 'Type of Project', item, realIdx)}>
                                                {isEditable ? (
                                                    <select
                                                        value={item.project_type || 'Goods'}
                                                        onChange={(e) => onUpdateItem(realIdx, 'project_type', e.target.value)}
                                                        className="w-full text-xs p-1 border border-slate-300 rounded bg-white"
                                                    >
                                                        <option value="Goods">Goods</option>
                                                        <option value="Infrastructure Projects">Infrastructure Projects</option>
                                                        <option value="Consulting Services">Consulting Services</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-slate-800">{item.project_type || 'Goods'}</span>
                                                )}
                                            </CommentableCell>

                                            {/* Quantity & Size */}
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
                                                className="align-top"
                                            
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

                                            {/* Mode of Procurement */}
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
                                            
                                        onUpdateCellValue={getCellUpdateHandler('procurement_mode', 'Recommended Mode of Procurement', item, realIdx)}>
                                                {isEditable ? (
                                                    <select
                                                        value={item.procurement_mode || (modesList[0]?.name || 'Competitive Bidding (RA 12009)')}
                                                        onChange={(e) => onUpdateItem(realIdx, 'procurement_mode', e.target.value)}
                                                        className="w-full text-xs p-1 border border-slate-300 rounded bg-white font-medium text-slate-800"
                                                    >
                                                        {/* Preserve existing item value if inactive or not in current list */}
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

                                            {/* Pre-Proc Conf */}
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
                                                className="text-center"
                                            
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

                                            {/* Start Activity */}
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
                                                className="text-center align-top"
                                            
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

                                            {/* End Activity */}
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
                                                className="text-center align-top"
                                            
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

                                            {/* Expected Delivery Period */}
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
                                                className="text-center align-top"
                                            
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

                                            {/* Source of Funds */}
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
                                                className="align-top"
                                            
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

                                            {/* Estimated Budget */}
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
                                                className="text-right"
                                            
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
                                                        className="w-full text-xs p-1 border border-slate-300 rounded text-right font-mono font-bold text-blue-900"
                                                    />
                                                ) : (
                                                    <span className="font-mono font-bold text-slate-900">
                                                        {formatCurrency(item.estimated_budget)}
                                                    </span>
                                                )}
                                            </CommentableCell>

                                            {/* Attached Supporting Documents */}
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
                                                className="align-top min-w-[170px]"
                                            
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

                                            {/* Remarks */}
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
                                                className="align-top"
                                            
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

                        {/* Bottom Summary Rows */}
                        <tr className="border-t-2 border-slate-800 font-semibold text-xs bg-slate-50 divide-x divide-slate-300">
                            <td colSpan={9} className="p-2.5 text-right font-bold text-slate-700 uppercase tracking-wider align-middle">
                                Total Estimated Budget:
                            </td>
                            <td colSpan={4} className="p-3 text-center align-middle bg-blue-900 text-white font-bold">
                                <div className="text-[11px] uppercase tracking-wider text-slate-200">TOTAL BUDGET:</div>
                                <div className="font-mono text-base font-extrabold text-amber-300 mt-0.5">
                                    {formatCurrency(totalBudget)}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {isEditable && (
                <div className="mt-3 flex items-center gap-3 no-print">
                    <button
                        type="button"
                        onClick={onAddItem}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Add Procurement Item Row
                    </button>
                </div>
            )}
        </div>
    );
};
