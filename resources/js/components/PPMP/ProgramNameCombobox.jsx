import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Plus, Edit3, Bookmark, Compass } from 'lucide-react';
import { programNameService } from '../../services/api';

export const ProgramNameCombobox = ({
    value = '',
    onChange,
    selectedId = null,
    onSelectId = null,
    programNames = null,
    placeholder = 'Search Program Name...',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sectorFilter, setSectorFilter] = useState('ALL');
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customText, setCustomText] = useState(value || '');

    const [programsList, setProgramsList] = useState(
        Array.isArray(programNames) && programNames.length > 0 ? programNames : []
    );
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);

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
        if (Array.isArray(programNames) && programNames.length > 0) {
            setProgramsList(programNames);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const loadPrograms = () => {
            programNameService.getAll({ active_only: 1 })
                .then(res => {
                    if (isMounted && Array.isArray(res.data)) {
                        setProgramsList(res.data);
                    }
                })
                .catch(() => {})
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };

        loadPrograms();

        const handleProgramsChanged = () => {
            if (isMounted) loadPrograms();
        };
        window.addEventListener('program-names:changed', handleProgramsChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('program-names:changed', handleProgramsChanged);
        };
    }, [programNames]);

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

    const sectors = useMemo(() => {
        const set = new Set();
        programsList.forEach(p => {
            if (p.sector) set.add(p.sector);
        });
        return Array.from(set).sort();
    }, [programsList]);

    const filteredPrograms = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return programsList.filter(item => {
            if (sectorFilter !== 'ALL' && item.sector !== sectorFilter) {
                return false;
            }
            if (!q) return true;

            const nameMatch = item.name && item.name.toLowerCase().includes(q);
            const sectorMatch = item.sector && item.sector.toLowerCase().includes(q);
            const respMatch = item.responsibility_center && item.responsibility_center.toLowerCase().includes(q);

            return nameMatch || sectorMatch || respMatch;
        });
    }, [programsList, searchQuery, sectorFilter]);

    const handleSelect = (record) => {

        const cleanName = record.name.trim();

        if (onChange) {
            onChange(cleanName, record);
        }
        if (onSelectId) {
            onSelectId(record.id);
        }

        setIsOpen(false);
        setSearchQuery('');
        setIsCustomMode(false);
    };

    const handleClear = (e) => {
        if (e) e.stopPropagation();
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

    const formatSectorPill = (sec) => {
        return sec.replace(/^(I|II|III|IV|V|VI|VII|VIII)\.\s*/, '');
    };

    return (
        <div className={`relative w-full ${className}`}>

            {isCustomMode ? (
                <div className="space-y-1 bg-blue-50/60 p-2 rounded-md border border-blue-200">
                    <div className="flex items-center justify-between text-[10px] font-bold text-blue-900 px-0.5">
                        <span>Custom Program Name:</span>
                        <button
                            type="button"
                            onClick={() => setIsCustomMode(false)}
                            className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                            Back to Search
                        </button>
                    </div>
                    <textarea
                        rows={2}
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="Type Program Name here..."
                        className="w-full text-[11px] p-2 font-bold text-center border border-blue-300 rounded bg-white text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-snug"
                    />
                    <div className="flex justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={handleCustomSave}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                            Apply Text
                        </button>
                    </div>
                </div>
            ) : value ? (

                <div
                    ref={triggerRef}
                    className="space-y-1 bg-blue-50/60 p-2 rounded-md border border-blue-200 group transition hover:border-blue-300"
                >
                    <div className="flex items-center justify-between text-[10px] font-bold text-blue-900 px-0.5">
                        <span className="flex items-center gap-1">
                            <Bookmark className="w-3 h-3 text-blue-600" />
                            Program Name:
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(prev => !prev)}
                                className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
                            >
                                Change
                            </button>
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold px-1 rounded hover:bg-rose-50 cursor-pointer"
                                title="Remove Program Name"
                            >
                                ✕ Remove
                            </button>
                        </div>
                    </div>
                    <div
                        onClick={() => setIsOpen(prev => !prev)}
                        className="w-full text-[11px] p-2 font-bold text-center border border-blue-300 rounded bg-white text-blue-950 cursor-pointer hover:bg-blue-50/30 transition shadow-2xs leading-snug flex items-center justify-between"
                        title="Click to search or change Program Name"
                    >
                        <span className="flex-1 text-center truncate">{value}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-blue-600 shrink-0 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            ) : (

                <div className="flex justify-center" ref={triggerRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(prev => !prev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded shadow-2xs transition cursor-pointer"
                        title="Click to select or search Program Name"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Program Name
                        <ChevronDown className={`w-3 h-3 text-blue-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
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
                                placeholder="Type to search Program Name..."
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
                            <button
                                type="button"
                                onClick={() => setSectorFilter('ALL')}
                                className={`px-2 py-0.5 rounded-full border transition cursor-pointer whitespace-nowrap shrink-0 ${
                                    sectorFilter === 'ALL'
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                ALL SECTORS
                            </button>
                            {sectors.map((sec) => (
                                <button
                                    key={sec}
                                    type="button"
                                    onClick={() => setSectorFilter(sec)}
                                    className={`px-2 py-0.5 rounded-full border transition cursor-pointer whitespace-nowrap shrink-0 ${
                                        sectorFilter === sec
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {formatSectorPill(sec)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-3 py-1 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                        <span>
                            {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''} found
                            {filteredPrograms.length > 50 ? ' (showing top 50)' : ''}
                        </span>
                        <span className="font-semibold text-slate-600">LGU Program Directory</span>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-100 min-h-0">
                        {loading ? (
                            <div className="p-6 text-center text-xs text-slate-500">
                                Loading Program Names...
                            </div>
                        ) : filteredPrograms.length === 0 ? (
                            <div className="p-6 text-center space-y-2">
                                <p className="text-xs text-slate-500">
                                    No programs found matching "<span className="font-semibold text-slate-700">{searchQuery}</span>".
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
                                    Use "{searchQuery}" as custom Program Name
                                </button>
                            </div>
                        ) : (
                            filteredPrograms.slice(0, 50).map((record) => {
                                const isSelected = (selectedId && record.id === selectedId) ||
                                    (value && value.trim().toLowerCase() === record.name.trim().toLowerCase());

                                return (
                                    <div
                                        key={record.id}
                                        onClick={() => handleSelect(record)}
                                        className={`p-2.5 flex items-start justify-between gap-2.5 hover:bg-blue-50/70 transition cursor-pointer text-left w-full min-w-0 ${
                                            isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600 font-semibold' : ''
                                        }`}
                                    >
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            {record.sector && (
                                                <div className="text-[9px] font-bold uppercase tracking-wider text-blue-700 truncate">
                                                    {record.sector}
                                                </div>
                                            )}

                                            <div className="text-xs font-bold text-slate-900 break-words line-clamp-2">
                                                {record.name}
                                            </div>
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
                            Type custom program name...
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
