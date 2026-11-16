import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Landmark, Shield, Layers, Edit3, Sparkles } from 'lucide-react';
import { fundSourceService } from '../../services/api';

/**
 * SourceOfFundCombobox:
 * High-performance searchable & directly editable combobox for Provincial Government Sources of Fund.
 * 
 * Key Features:
 * 1. DIRECT CELL CUSTOMIZATION: Users can directly type, edit, and customize the text in the cell at any time.
 * 2. OFFICIAL CATALOG SELECTOR: A dedicated "Catalog" button opens the official catalog (filtered to Budget or PACCO).
 * 3. PORTAL RENDERING: Uses `createPortal(..., document.body)` with floating viewport coordinates (z-[99999]),
 *    guaranteeing zero clipping from table scroll containers (`overflow-x-auto`).
 */
export const SourceOfFundCombobox = ({
    value = '',
    onChange,
    selectedId = null,
    onSelectId = null,
    fiscalYear = null,
    fundSources = null,
    workflowRoute = null, // 'budget' | 'pacco' | null
    placeholder = 'Type custom fund or pick from catalog...',
    className = '',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'General Fund' | 'Special Fund' | 'Trust Fund'
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customText, setCustomText] = useState(value || '');

    const [sourcesList, setSourcesList] = useState(
        Array.isArray(fundSources) && fundSources.length > 0 ? fundSources : []
    );
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Resolve fiscal year for placeholder/display substitution
    const currentYear = useMemo(() => {
        if (!fiscalYear) return String(new Date().getFullYear());
        const match = String(fiscalYear).match(/\b(20\d{2}|\d{4})\b/);
        return match ? match[1] : String(fiscalYear).replace(/^CY\s*/i, '').trim();
    }, [fiscalYear]);

    // Format template names by substituting "(customize year e.g, 2026)" with actual fiscal year
    const formatFundName = useCallback((rawName) => {
        if (!rawName) return '';
        return rawName
            .replace(/\(customize year e\.g,\s*2026\)/gi, currentYear)
            .replace(/\(Customize year e\.g,\s*2026\)/gi, currentYear)
            .replace(/\bCY\s*2026\b/gi, `CY ${currentYear}`);
    }, [currentYear]);

    // Calculate fixed viewport position for portal dropdown
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const estimatedHeight = 360;
        const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

        // Desired width matches trigger or at least 360px, bounded by viewport
        const targetWidth = Math.min(Math.max(rect.width, 360), window.innerWidth - 24);
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

    // Load fund sources: selectively by workflowRoute if provided
    useEffect(() => {
        if (Array.isArray(fundSources) && fundSources.length > 0) {
            let filtered = fundSources;
            if (workflowRoute === 'budget') {
                filtered = filtered.filter(f => f.workflow_route === 'budget' || (f.category !== 'Trust Fund' && f.workflow_route !== 'pacco'));
            } else if (workflowRoute === 'pacco') {
                filtered = filtered.filter(f => f.workflow_route === 'pacco' || f.category === 'Trust Fund');
            }
            setSourcesList(filtered);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const params = { active_only: 1 };
        if (workflowRoute && workflowRoute !== 'ALL') {
            params.route = workflowRoute;
        }

        const loadSources = () => {
            fundSourceService.getAll(params)
                .then(res => {
                    if (isMounted && Array.isArray(res.data)) {
                        let list = res.data;
                        if (workflowRoute === 'budget') {
                            list = list.filter(f => f.workflow_route === 'budget' || (f.category !== 'Trust Fund' && f.workflow_route !== 'pacco'));
                        } else if (workflowRoute === 'pacco') {
                            list = list.filter(f => f.workflow_route === 'pacco' || f.category === 'Trust Fund');
                        }
                        setSourcesList(list);
                    }
                })
                .catch(() => {})
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };

        loadSources();

        const handleSourcesChanged = () => {
            if (isMounted) loadSources();
        };
        window.addEventListener('fund-sources:changed', handleSourcesChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('fund-sources:changed', handleSourcesChanged);
        };
    }, [workflowRoute, fundSources]);

    // Handle open/close and positioning
    useEffect(() => {
        if (isOpen) {
            updatePosition();
            const handleScrollOrResize = () => updatePosition();
            window.addEventListener('scroll', handleScrollOrResize, true);
            window.addEventListener('resize', handleScrollOrResize);

            // Focus search input
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 50);

            return () => {
                window.removeEventListener('scroll', handleScrollOrResize, true);
                window.removeEventListener('resize', handleScrollOrResize);
            };
        }
    }, [isOpen, updatePosition]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Filtered list based on search and category
    const filteredSources = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return sourcesList.filter(s => {
            // Category tab filter
            if (categoryFilter === 'General Fund') {
                if (s.workflow_route === 'pacco' || s.category === 'Trust Fund') return false;
            } else if (categoryFilter === 'Special Fund') {
                if (s.category !== 'Special Fund') return false;
            } else if (categoryFilter === 'Trust Fund') {
                if (s.workflow_route !== 'pacco' && s.category !== 'Trust Fund') return false;
            }

            if (!query) return true;

            const nameMatch = s.name && s.name.toLowerCase().includes(query);
            const formattedMatch = formatFundName(s.name).toLowerCase().includes(query);
            const codeMatch = s.code && s.code.toLowerCase().includes(query);
            const descMatch = s.description && s.description.toLowerCase().includes(query);

            return nameMatch || formattedMatch || codeMatch || descMatch;
        });
    }, [sourcesList, searchQuery, categoryFilter, formatFundName]);

    // Select a fund from official catalog
    const handleSelectFund = (source) => {
        const formattedName = formatFundName(source.name);
        onChange(formattedName);
        if (onSelectId) {
            onSelectId(source.id);
        }
        setIsOpen(false);
        setIsCustomMode(false);
        setSearchQuery('');
        // Focus cell textarea so user can customize immediately if desired
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    // Apply custom manual entry from popover
    const handleApplyCustom = () => {
        const trimmed = (customText || '').trim();
        if (trimmed) {
            onChange(trimmed);
            if (onSelectId) {
                onSelectId(null);
            }
        }
        setIsOpen(false);
        setIsCustomMode(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        if (onSelectId) onSelectId(null);
        setCustomText('');
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    // Match selected fund source item
    const matchedSource = useMemo(() => {
        if (selectedId) {
            const foundById = sourcesList.find(s => s.id === selectedId);
            if (foundById) return foundById;
        }
        if (!value) return null;
        const cleanVal = value.trim().toLowerCase();
        return sourcesList.find(s =>
            s.name.trim().toLowerCase() === cleanVal ||
            formatFundName(s.name).trim().toLowerCase() === cleanVal
        );
    }, [selectedId, value, sourcesList, formatFundName]);

    const isTrust = workflowRoute === 'pacco' ||
        matchedSource?.workflow_route === 'pacco' ||
        matchedSource?.category === 'Trust Fund' ||
        (value && stripos(value, 'trust') !== false);

    function stripos(str, search) {
        return (str || '').toLowerCase().indexOf((search || '').toLowerCase());
    }

    const isBudgetOnly = workflowRoute === 'budget';
    const isPaccoOnly = workflowRoute === 'pacco';

    return (
        <div className={`relative w-full ${className}`} ref={triggerRef}>
            {/* Direct Editable Cell Container */}
            <div
                className={`w-full text-xs border rounded-md transition flex flex-col min-h-[46px] ${
                    disabled
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : isOpen
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white shadow-xs'
                            : value
                                ? isTrust
                                    ? 'border-teal-300 bg-teal-50/30 hover:bg-teal-50/50'
                                    : 'border-blue-300 bg-blue-50/20 hover:bg-blue-50/40'
                                : 'border-slate-300 bg-white hover:bg-slate-50'
                }`}
            >
                {/* Cell Mini Header: Route badge, Clear, & Catalog button */}
                <div className="flex items-center justify-between px-2 pt-1 pb-0.5 text-[10px] text-slate-500 border-b border-slate-100 bg-slate-50/70 rounded-t-md">
                    <div className="flex items-center gap-1 min-w-0">
                        <Landmark className={`w-3 h-3 shrink-0 ${isTrust ? 'text-teal-600' : 'text-blue-600'}`} />
                        {matchedSource ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                matchedSource.workflow_route === 'pacco'
                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                                {matchedSource.workflow_route === 'pacco' ? 'PACCO' : 'Budget'}
                            </span>
                        ) : value ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                Customized
                            </span>
                        ) : (
                            <span className="text-[9px] italic text-slate-400">
                                {isTrust ? 'PACCO Route' : 'Budget Route'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {value && !disabled && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Clear source of fund"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!disabled) {
                                    setIsOpen(!isOpen);
                                }
                            }}
                            className={`p-0.5 rounded transition cursor-pointer flex items-center gap-0.5 px-1.5 py-0.5 font-bold text-[9px] ${
                                isOpen
                                    ? isTrust ? 'bg-teal-700 text-white shadow-2xs' : 'bg-blue-600 text-white shadow-2xs'
                                    : isTrust
                                        ? 'text-teal-700 hover:bg-teal-100/70 bg-teal-50 border border-teal-200'
                                        : 'text-blue-700 hover:bg-blue-100/70 bg-blue-50 border border-blue-200'
                            }`}
                            title="Browse and select from official catalog"
                        >
                            <span>Catalog</span>
                            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Direct Editable Text Area in the Cell */}
                <textarea
                    ref={textareaRef}
                    rows={2}
                    disabled={disabled}
                    value={value}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChange(val);
                        // Check if typed text matches an official source
                        const clean = val.trim().toLowerCase();
                        const match = sourcesList.find(s =>
                            s.name.trim().toLowerCase() === clean ||
                            formatFundName(s.name).trim().toLowerCase() === clean
                        );
                        if (onSelectId) {
                            onSelectId(match ? match.id : null);
                        }
                    }}
                    placeholder={placeholder || (isTrust ? "Type custom fund or pick from PACCO catalog..." : "Type custom fund or pick from Budget catalog...")}
                    className="w-full text-xs font-semibold px-2 py-1 bg-transparent focus:outline-none resize-y min-h-[32px] text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:italic leading-relaxed"
                />
            </div>

            {/* Viewport Floating Dropdown Menu (via React Portal to document.body) */}
            {isOpen && coords && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        top: coords.top !== undefined ? `${coords.top}px` : undefined,
                        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999, // Float above all tables, headers, and modals
                    }}
                    className="bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-100 ring-1 ring-black/5"
                >
                    {/* Header: Title & Close */}
                    <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2 min-w-0">
                            <Landmark className={`w-4 h-4 shrink-0 ${isPaccoOnly ? 'text-teal-400' : 'text-blue-400'}`} />
                            <div className="min-w-0">
                                <div className="text-xs font-bold leading-tight flex items-center gap-1.5 truncate">
                                    <span>Official Source of Funds</span>
                                    {isBudgetOnly && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 border border-blue-400/30">
                                            Budget Route
                                        </span>
                                    )}
                                    {isPaccoOnly && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-500/30 text-teal-300 border border-teal-400/30">
                                            PACCO Route
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-300 font-medium truncate">
                                    {isBudgetOnly
                                        ? `Budget Office Catalog • General & Special Funds • FY ${currentYear}`
                                        : isPaccoOnly
                                            ? `Provincial Accountant (PACCO) Catalog • Trust Funds • FY ${currentYear}`
                                            : `Provincial Accountant & Budget Office Catalog • FY ${currentYear}`}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Mode Toggle: Official Catalog vs Custom Text */}
                    <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setIsCustomMode(false)}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                                    !isCustomMode
                                        ? isPaccoOnly
                                            ? 'bg-teal-700 text-white shadow-2xs'
                                            : 'bg-blue-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Official Catalog ({sourcesList.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCustomMode(true);
                                    setCustomText(value || '');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                                    isCustomMode
                                        ? isPaccoOnly
                                            ? 'bg-teal-700 text-white shadow-2xs'
                                            : 'bg-blue-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Edit3 className="w-3 h-3" />
                                <span>Custom / Other</span>
                            </button>
                        </div>

                        {value && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* CUSTOM INPUT MODE */}
                    {isCustomMode ? (
                        <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
                            <label className="block text-[11px] font-bold text-slate-700">
                                Enter Custom Source of Funds text:
                            </label>
                            <textarea
                                rows={3}
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                                placeholder={isPaccoOnly ? 'e.g. Special Trust Grant / Donor Fiduciary Fund...' : 'e.g. Special General Allocation / OPG Purpose...'}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsCustomMode(false)}
                                    className="px-2.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyCustom}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer ${
                                        isPaccoOnly ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    Apply Custom Text
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* CATALOG LIST MODE */
                        <>
                            {/* Search Bar & Category Filters */}
                            <div className="p-2 space-y-1.5 border-b border-slate-100 bg-white">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={isPaccoOnly ? "Filter PACCO trust funds (e.g. PENRO, MAIFIP, DOE)..." : "Filter budget funds (e.g. General Fund, SEF, 20% Dev)..."}
                                        className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Category Tabs - Route specific */}
                                <div className="flex items-center gap-1 text-[10px] flex-wrap">
                                    {isBudgetOnly ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('ALL')}
                                                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                                                    categoryFilter === 'ALL'
                                                        ? 'bg-slate-800 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                All Budget Funds ({sourcesList.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('General Fund')}
                                                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                                                    categoryFilter === 'General Fund'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                }`}
                                            >
                                                General Fund
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('Special Fund')}
                                                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                                                    categoryFilter === 'Special Fund'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                                }`}
                                            >
                                                Special Fund (SEF / Health)
                                            </button>
                                        </>
                                    ) : isPaccoOnly ? (
                                        <button
                                            type="button"
                                            onClick={() => setCategoryFilter('ALL')}
                                            className="px-2 py-0.5 rounded font-bold bg-teal-700 text-white text-[10px]"
                                        >
                                            All PACCO Trust Funds ({sourcesList.length})
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('ALL')}
                                                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                                                    categoryFilter === 'ALL'
                                                        ? 'bg-slate-800 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                All Funds
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('General Fund')}
                                                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                                                    categoryFilter === 'General Fund'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                }`}
                                            >
                                                <span>General &amp; Special</span>
                                                <span className="text-[9px] opacity-80">(Budget)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCategoryFilter('Trust Fund')}
                                                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                                                    categoryFilter === 'Trust Fund'
                                                        ? 'bg-teal-600 text-white'
                                                        : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                                                }`}
                                            >
                                                <span>Trust Funds</span>
                                                <span className="text-[9px] opacity-80">(PACCO)</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* List of Fund Sources */}
                            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                {loading ? (
                                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                                        Loading sources of fund...
                                    </div>
                                ) : filteredSources.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-500">
                                        <p className="font-semibold">No fund sources match "{searchQuery}"</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomMode(true);
                                                setCustomText(searchQuery);
                                            }}
                                            className="mt-2 text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Use "{searchQuery}" as custom source of fund</span>
                                        </button>
                                    </div>
                                ) : (
                                    filteredSources.map((source) => {
                                        const formattedName = formatFundName(source.name);
                                        const isSelected = selectedId
                                            ? source.id === selectedId
                                            : value && (value.trim().toLowerCase() === formattedName.trim().toLowerCase() || value.trim().toLowerCase() === source.name.trim().toLowerCase());
                                        const isTrustRoute = source.workflow_route === 'pacco';

                                        return (
                                            <div
                                                key={source.id}
                                                onClick={() => handleSelectFund(source)}
                                                className={`p-2 rounded-lg cursor-pointer transition flex items-start justify-between gap-2 border ${
                                                    isSelected
                                                        ? isTrustRoute
                                                            ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/20'
                                                            : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500/20'
                                                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-xs text-slate-900 leading-tight">
                                                            {formattedName}
                                                        </span>
                                                        {source.code && (
                                                            <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                {source.code}
                                                            </span>
                                                        )}
                                                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                                                            isTrustRoute
                                                                ? 'bg-teal-100 text-teal-800'
                                                                : 'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {isTrustRoute ? 'PACCO Review' : 'Budget Review'}
                                                        </span>
                                                    </div>
                                                    {source.description && (
                                                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 leading-snug">
                                                            {source.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {isSelected && (
                                                    <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                                                        isTrustRoute ? 'bg-teal-600 text-white' : 'bg-blue-600 text-white'
                                                    }`}>
                                                        <Check className="w-2.5 h-2.5" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* Footer Tip */}
                    <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate font-medium">
                            {isBudgetOnly
                                ? 'Routes to Budget Officer (General & Special Funds).'
                                : isPaccoOnly
                                    ? 'Routes to PACCO Reviewer (Trust Funds & Grants).'
                                    : 'Trust Funds route to PACCO; General & Special Funds route to Budget.'}
                        </span>
                        <span className="font-semibold text-slate-700 shrink-0">
                            {filteredSources.length} option(s)
                        </span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SourceOfFundCombobox;
