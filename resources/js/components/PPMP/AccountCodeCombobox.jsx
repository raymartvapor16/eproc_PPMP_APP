import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, BookOpen, Layers, Edit3, Sparkles } from 'lucide-react';
import { accountCodeService } from '../../services/api';

export const AccountCodeCombobox = ({
    value = '',
    onChange,
    selectedId = null,
    onSelectId = null,
    accountCodes = null,
    placeholder = 'Search Account Code (e.g. 5-02-03-220 or Office Supplies)...',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('ALL');
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customText, setCustomText] = useState(value || '');

    const [codesList, setCodesList] = useState(
        Array.isArray(accountCodes) && accountCodes.length > 0 ? accountCodes : []
    );
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);

    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const estimatedHeight = 380;
        const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

        const targetWidth = Math.min(Math.max(rect.width, 380), window.innerWidth - 24);
        let left = rect.left;
        if (left + targetWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - targetWidth - 12);
        }
        if (left < 12) left = 12;

        const maxHeight = openUpward
            ? Math.min(420, spaceAbove - 20)
            : Math.min(420, spaceBelow - 20);

        setCoords({
            left,
            width: targetWidth,
            openUpward,
            top: openUpward ? undefined : rect.bottom + 6,
            bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
            maxHeight,
        });
    }, []);

    useEffect(() => {
        if (Array.isArray(accountCodes) && accountCodes.length > 0) {
            setCodesList(accountCodes);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const loadCodes = () => {
            accountCodeService.getAll({ active_only: 1 })
                .then(res => {
                    if (isMounted && Array.isArray(res.data)) {
                        setCodesList(res.data);
                    }
                })
                .catch(() => {})
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };

        loadCodes();

        const handleCodesChanged = () => {
            if (isMounted) loadCodes();
        };
        window.addEventListener('account-codes:changed', handleCodesChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('account-codes:changed', handleCodesChanged);
        };
    }, [accountCodes]);

    useEffect(() => {
        setCustomText(value || '');
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();

        const handleClickOutside = (e) => {
            const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
            const inMenu = menuRef.current && menuRef.current.contains(e.target);
            if (!inTrigger && !inMenu) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        const handleScrollOrResize = () => {
            updatePosition();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleScrollOrResize);
        window.addEventListener('scroll', handleScrollOrResize, true);

        const focusTimer = setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }, 60);

        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleScrollOrResize);
            window.removeEventListener('scroll', handleScrollOrResize, true);
        };
    }, [isOpen, updatePosition]);

    const filteredCodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return codesList.filter(item => {
            if (classFilter !== 'ALL' && item.account_class !== classFilter) {
                return false;
            }
            if (!q) return true;

            const codeMatch = item.code && item.code.toLowerCase().includes(q);
            const nameMatch = item.name && item.name.toLowerCase().includes(q);
            const parentMatch = item.parent_name && item.parent_name.toLowerCase().includes(q);
            const subMatch = item.sub_code && item.sub_code.toLowerCase().includes(q);
            const descMatch = item.full_description && item.full_description.toLowerCase().includes(q);

            return codeMatch || nameMatch || parentMatch || subMatch || descMatch;
        });
    }, [codesList, searchQuery, classFilter]);

    const parsedCurrentValue = useMemo(() => {
        if (!value) return null;
        const trimmed = String(value).trim();
        const codeMatch = trimmed.match(/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/);
        const code = codeMatch ? codeMatch[0] : null;

        if (code) {
            const matched = codesList.find(c => c.code === code);
            if (matched) return matched;
        }

        return {
            code: code || '',
            name: trimmed.replace(code || '', '').replace(/\n|•/g, ' ').trim() || trimmed,
            account_class: code ? (code[0] === '5' ? 'Expenses' : (code[0] === '1' ? 'Assets' : 'Other')) : 'Custom',
        };
    }, [value, codesList]);

    const handleSelect = (record) => {

        let formattedValue = '';
        if (record.parent_name && record.parent_name !== record.name) {
            formattedValue = `${record.parent_name} - ${record.name}\n${record.code || ''}`.trim();
        } else if (record.code) {
            formattedValue = `${record.name}\n${record.code}`.trim();
        } else {
            formattedValue = record.name;
        }

        if (onChange) {
            onChange(formattedValue, record);
        }
        if (onSelectId) {
            onSelectId(record.id);
        }

        setIsOpen(false);
        setSearchQuery('');
        setIsCustomMode(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        if (onChange) onChange('', null);
        if (onSelectId) onSelectId(null);
        setCustomText('');
        setIsCustomMode(false);
    };

    const handleCustomSave = () => {
        if (onChange) onChange(customText.trim(), null);
        if (onSelectId) onSelectId(null);
        setIsCustomMode(false);
    };

    const getClassColor = (cls) => {
        switch (cls) {
            case 'Expenses':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Assets':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Liabilities':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Income':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>

            {isCustomMode ? (
                <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-300 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Custom Account Code:</span>
                        <button
                            type="button"
                            onClick={() => setIsCustomMode(false)}
                            className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                            Back to Search Dropdown
                        </button>
                    </div>
                    <textarea
                        rows={2}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="Semi-Expendable Furnitures, Fixtures & Books Expenses&#10;5-02-03-220"
                        className="w-full text-xs p-2 font-bold text-center border border-slate-400 rounded bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={handleCustomSave}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                            Apply Text
                        </button>
                    </div>
                </div>
            ) : (

                <div
                    ref={triggerRef}
                    onClick={() => setIsOpen(prev => !prev)}
                    className={`min-h-[44px] p-2 rounded-lg border text-center transition cursor-pointer select-none flex flex-col items-center justify-center relative ${
                        value
                            ? 'bg-blue-50/40 border-blue-300 hover:border-blue-400'
                            : 'bg-white border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                    }`}
                    title="Click to search and select Account Code from Chart of Accounts"
                >
                    {value ? (
                        <div className="w-full flex flex-col items-center justify-center gap-0.5 px-6">
                            {parsedCurrentValue?.code && (
                                <span className="inline-flex items-center gap-1 font-mono font-extrabold text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                                    <BookOpen className="w-3 h-3 text-blue-700" />
                                    {parsedCurrentValue.code}
                                </span>
                            )}
                            <div className="text-[11px] font-bold text-slate-900 leading-snug whitespace-pre-wrap">
                                {parsedCurrentValue?.name || value}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <span>{placeholder}</span>
                        </div>
                    )}

                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {value && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
                                title="Clear account code"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
                    </div>
                </div>
            )}

            {isOpen && coords && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: coords.top !== undefined ? `${coords.top}px` : 'auto',
                        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 999999,
                    }}
                    className="bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                >

                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type code (e.g. 5-02-03-220) or name..."
                                className="w-full text-xs pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div
                            className="flex items-center gap-1 overflow-x-auto text-[10px] font-bold py-0.5"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {['ALL', 'Expenses', 'Assets', 'Liabilities', 'Income'].map((cls) => (
                                <button
                                    key={cls}
                                    type="button"
                                    onClick={() => setClassFilter(cls)}
                                    className={`px-2 py-0.5 rounded-full border transition cursor-pointer whitespace-nowrap shrink-0 ${
                                        classFilter === cls
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {cls === 'Expenses' ? 'Expenses (5-xx)' : (cls === 'Assets' ? 'Assets (1-xx)' : cls)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-3 py-1 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                        <span>
                            {filteredCodes.length} account{filteredCodes.length !== 1 ? 's' : ''} found
                            {filteredCodes.length > 40 ? ' (showing top 40)' : ''}
                        </span>
                        <span className="font-semibold text-slate-600">Chart of Accounts</span>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 min-h-0">
                        {loading ? (
                            <div className="p-6 text-center text-xs text-slate-500">
                                Loading Chart of Accounts...
                            </div>
                        ) : filteredCodes.length === 0 ? (
                            <div className="p-6 text-center space-y-2">
                                <p className="text-xs text-slate-500">
                                    No account codes found matching "<span className="font-semibold text-slate-700">{searchQuery}</span>".
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomText(searchQuery);
                                        setIsCustomMode(true);
                                        setIsOpen(false);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Use "{searchQuery}" as custom text
                                </button>
                            </div>
                        ) : (
                            filteredCodes.slice(0, 40).map((record) => {
                                const isSelected = (selectedId && record.id === selectedId) ||
                                    (record.code && value && String(value).includes(record.code));

                                return (
                                    <div
                                        key={record.id}
                                        onClick={() => handleSelect(record)}
                                        className={`p-2.5 flex items-start justify-between gap-2.5 hover:bg-blue-50/70 transition cursor-pointer text-left w-full min-w-0 ${
                                            isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600 font-semibold' : ''
                                        }`}
                                    >
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {record.code ? (
                                                    <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-100/80 px-1.5 py-0.2 rounded border border-blue-200 shrink-0">
                                                        {record.code}
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded shrink-0">
                                                        Sub-Item
                                                    </span>
                                                )}

                                                {record.sub_code && (
                                                    <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 shrink-0">
                                                        {record.sub_code}
                                                    </span>
                                                )}

                                                {record.account_class && (
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0 ${getClassColor(record.account_class)}`}>
                                                        {record.account_class}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs font-bold text-slate-900 break-words line-clamp-2">
                                                {record.name}
                                            </div>

                                            {record.parent_name && record.parent_name !== record.name && (
                                                <div className="text-[10px] text-slate-500 italic break-words line-clamp-1">
                                                    Under: {record.parent_name}
                                                </div>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <span className="text-blue-600 shrink-0 mt-0.5">
                                                <Check className="w-4 h-4 font-bold" />
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setCustomText(value || '');
                                setIsCustomMode(true);
                                setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700 font-medium cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            Type custom account code text...
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-2 py-0.5 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
