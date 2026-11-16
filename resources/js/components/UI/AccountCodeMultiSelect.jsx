import React, { useState, useEffect, useMemo } from 'react';
import { Search, Check, X, BookOpen, Layers, Filter, CheckSquare, Square } from 'lucide-react';
import { accountCodeService } from '../../services/api';

/**
 * AccountCodeMultiSelect:
 * Searchable multi-checkbox selector for assigning Chart of Accounts to BAC-TWG Reviewers.
 * Supports:
 * - Real-time keyword filter (code, name, parent)
 * - Category filter pills (All, Expenses, Assets, Liabilities, Income)
 * - Select All Filtered / Clear All
 * - Visual chips of selected codes
 * - Fast performance with 800+ account codes
 */
export const AccountCodeMultiSelect = ({
    selectedIds = [],
    onChange,
    accountCodes = null,
    isPublic = false,
    maxHeight = 'max-h-64',
    title = 'Assigned Account Codes',
    helperText = 'Select the account codes assigned to this BAC-TWG Reviewer for technical evaluation.',
}) => {
    const [codesList, setCodesList] = useState(
        Array.isArray(accountCodes) && accountCodes.length > 0 ? accountCodes : []
    );
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('ALL');

    // Load account codes if not provided
    useEffect(() => {
        if (Array.isArray(accountCodes) && accountCodes.length > 0) {
            setCodesList(accountCodes);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const fetcher = isPublic ? accountCodeService.getPublic() : accountCodeService.getAll({ all: 1, status: 'active' });
        fetcher
            .then((res) => {
                if (!isMounted) return;
                const raw = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
                setCodesList(raw);
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [accountCodes, isPublic]);

    // Fast filtered codes
    const filteredCodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return codesList.filter((item) => {
            if (classFilter !== 'ALL' && item.account_class !== classFilter) {
                return false;
            }
            if (!q) return true;

            const codeMatch = item.code && item.code.toLowerCase().includes(q);
            const nameMatch = item.name && item.name.toLowerCase().includes(q);
            const parentMatch = item.parent_name && item.parent_name.toLowerCase().includes(q);

            return codeMatch || nameMatch || parentMatch;
        });
    }, [codesList, searchQuery, classFilter]);

    // Selected items map / objects
    const selectedMap = useMemo(() => {
        const map = new Set();
        (selectedIds || []).forEach((id) => map.add(Number(id)));
        return map;
    }, [selectedIds]);

    const selectedObjects = useMemo(() => {
        return codesList.filter((c) => selectedMap.has(Number(c.id)));
    }, [codesList, selectedMap]);

    // Toggle individual ID
    const toggleCode = (id) => {
        const numId = Number(id);
        const next = new Set(selectedMap);
        if (next.has(numId)) {
            next.delete(numId);
        } else {
            next.add(numId);
        }
        onChange(Array.from(next));
    };

    // Remove single ID chip
    const handleRemoveId = (id) => {
        const next = selectedIds.filter((item) => Number(item) !== Number(id));
        onChange(next);
    };

    // Select all filtered items
    const handleSelectAllFiltered = () => {
        const next = new Set(selectedMap);
        filteredCodes.forEach((c) => next.add(Number(c.id)));
        onChange(Array.from(next));
    };

    // Clear all selections
    const handleClearAll = () => {
        onChange([]);
    };

    // Color badges helper
    const getClassBadge = (cls) => {
        switch (cls) {
            case 'Expenses':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'Assets':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Liabilities':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Income':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="bg-slate-50/80 border-2 border-blue-300 rounded-2xl p-3.5 space-y-3 shadow-xs">
            {/* Header & Selected count badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-2.5">
                <div>
                    <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-blue-700" />
                        <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                            {title}
                        </span>
                        <span className="text-rose-500 font-bold">*</span>
                    </div>
                    {helperText && (
                        <p className="text-[11px] text-blue-900 mt-0.5 leading-relaxed font-medium">
                            {helperText}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border transition ${
                        selectedIds.length > 0
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                        {selectedIds.length} Assigned
                    </span>

                    {selectedIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Selected Chips Bar (if any selected) */}
            {selectedObjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white border border-blue-200 rounded-xl shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0 mr-1">
                        Active:
                    </span>
                    {selectedObjects.slice(0, 15).map((record) => (
                        <span
                            key={record.id}
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 border border-blue-300"
                        >
                            <span>{record.code || record.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveId(record.id)}
                                className="text-blue-500 hover:text-rose-700 hover:bg-rose-100 rounded-full p-0.5 cursor-pointer"
                                title="Remove"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </span>
                    ))}
                    {selectedObjects.length > 15 && (
                        <span className="text-[10px] font-bold text-slate-500 italic">
                            +{selectedObjects.length - 15} more
                        </span>
                    )}
                </div>
            )}

            {/* Search Bar & Category Filters */}
            <div className="space-y-2">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search account code (e.g. 5-02-03-220) or name..."
                        className="w-full text-xs pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Class Filters & Select All Button */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto text-[10px] font-bold pb-0.5">
                    <div
                        className="flex items-center gap-1 shrink-0 overflow-x-auto"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {['ALL', 'Expenses', 'Assets', 'Liabilities', 'Income'].map((cls) => (
                            <button
                                key={cls}
                                type="button"
                                onClick={() => setClassFilter(cls)}
                                className={`px-2 py-0.5 rounded-full border transition cursor-pointer whitespace-nowrap ${
                                    classFilter === cls
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {cls === 'Expenses' ? 'Expenses (5-xx)' : (cls === 'Assets' ? 'Assets (1-xx)' : cls)}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline shrink-0 cursor-pointer"
                    >
                        Select All ({filteredCodes.length})
                    </button>
                </div>
            </div>

            {/* Checkbox List Container */}
            <div className={`bg-white border border-slate-300 rounded-xl divide-y divide-slate-100 ${maxHeight} overflow-y-auto overflow-x-hidden shadow-inner`}>
                {loading ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                        Loading Chart of Accounts...
                    </div>
                ) : filteredCodes.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                        <p>No account codes found matching "{searchQuery}".</p>
                        <p className="text-[10px] text-slate-400">Try searching with a code number or keyword.</p>
                    </div>
                ) : (
                    filteredCodes.map((record) => {
                        const isChecked = selectedMap.has(Number(record.id));

                        return (
                            <label
                                key={record.id}
                                className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition select-none hover:bg-blue-50/60 ${
                                    isChecked ? 'bg-blue-50/80 font-semibold' : ''
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleCode(record.id)}
                                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                                />

                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {record.code && (
                                            <span className="font-mono text-xs font-black text-blue-900 bg-blue-100/90 px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                                                {record.code}
                                            </span>
                                        )}
                                        {record.account_class && (
                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0 ${getClassBadge(record.account_class)}`}>
                                                {record.account_class}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-900 break-words leading-snug">
                                        {record.name}
                                    </div>
                                    {record.parent_name && record.parent_name !== record.name && (
                                        <div className="text-[10px] text-slate-500 italic truncate">
                                            Under: {record.parent_name}
                                        </div>
                                    )}
                                </div>
                            </label>
                        );
                    })
                )}
            </div>

            <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
                <span>Showing {filteredCodes.length} account code{filteredCodes.length !== 1 ? 's' : ''}</span>
                <span className="font-semibold text-blue-900">Philippine LGU Chart of Accounts</span>
            </div>
        </div>
    );
};

