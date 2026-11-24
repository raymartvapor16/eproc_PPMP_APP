import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Plus, X, Tag, Check, Sparkles } from 'lucide-react';

export const DEFAULT_PROCUREMENT_UNITS = [

    { value: 'pcs', label: 'Piece (pcs)', category: 'Counting', example: 'General supplies, pens, chairs' },
    { value: 'unit', label: 'Unit', category: 'Counting', example: 'Equipment, computers, appliances' },
    { value: 'set', label: 'Set', category: 'Counting', example: 'Tool set, furniture set, uniform set' },
    { value: 'lot', label: 'Lot', category: 'Counting', example: 'Lump sum packages, bundled goods' },
    { value: 'pair', label: 'Pair', category: 'Counting', example: 'Shoes, boots, safety gloves' },
    { value: 'pack', label: 'Pack', category: 'Packaging', example: 'Batteries, snacks, wipes, pouches' },
    { value: 'box', label: 'Box', category: 'Packaging', example: 'Envelopes, fasteners, clips, staples' },
    { value: 'carton', label: 'Carton (ctn)', category: 'Packaging', example: 'Bulk goods, canned items' },
    { value: 'case', label: 'Case', category: 'Packaging', example: 'Beverages, canned goods, containers' },
    { value: 'bundle', label: 'Bundle', category: 'Packaging', example: 'Documents, brooms, wooden sticks' },

    { value: 'ream', label: 'Ream', category: 'Office Supplies', example: 'Bond paper, copy paper, mimeographing' },
    { value: 'roll', label: 'Roll', category: 'Office Supplies', example: 'Tape, thermal paper, ribbon, vinyl' },
    { value: 'pad', label: 'Pad', category: 'Office Supplies', example: 'Note pad, memo pad, sticky notes' },
    { value: 'sheet', label: 'Sheet', category: 'Office Supplies', example: 'Card stock, tarpaulin, specialty paper' },
    { value: 'book', label: 'Book', category: 'Office Supplies', example: 'Logbook, record book, ledger' },
    { value: 'booklet', label: 'Booklet', category: 'Office Supplies', example: 'Official receipt, ticket booklet' },
    { value: 'tube', label: 'Tube', category: 'Office Supplies', example: 'Adhesive, ink, sealant, silicone' },
    { value: 'cartridge', label: 'Cartridge', category: 'Office Supplies', example: 'Printer ink, toner cartridge' },

    { value: 'liter', label: 'Liter (L)', category: 'Volume / Liquid', example: 'Disinfectant, alcohol, fuel, oil' },
    { value: 'gallon', label: 'Gallon (gal)', category: 'Volume / Liquid', example: 'Paint, cleaning agent, water' },
    { value: 'bottle', label: 'Bottle (btl)', category: 'Volume / Liquid', example: 'Medicine, chemical solution, reagent' },
    { value: 'can', label: 'Can (tin)', category: 'Volume / Liquid', example: 'Paint, spray, lubricant, sealer' },
    { value: 'drum', label: 'Drum', category: 'Volume / Liquid', example: 'Fuel, oil, asphalt, bitumen' },
    { value: 'pail', label: 'Pail', category: 'Volume / Liquid', example: 'Paint, grease, cleaning solution' },
    { value: 'vial', label: 'Vial', category: 'Medical', example: 'Vaccine, injectable medicine' },
    { value: 'ampoule', label: 'Ampoule', category: 'Medical', example: 'Liquid medications' },
    { value: 'jar', label: 'Jar', category: 'Medical / Food', example: 'Ointment, preserves, paste' },

    { value: 'kg', label: 'Kilogram (kg)', category: 'Weight', example: 'Rice, meat, chemicals, fertilizer' },
    { value: 'gram', label: 'Gram (g)', category: 'Weight', example: 'Laboratory reagents, spices' },
    { value: 'bag', label: 'Bag', category: 'Weight / Bulk', example: 'Cement, fertilizer, seeds' },
    { value: 'sack', label: 'Sack', category: 'Weight / Bulk', example: 'Rice, grains, animal feed' },
    { value: 'MT', label: 'Metric Ton (MT)', category: 'Weight / Bulk', example: 'Aggregates, road materials' },

    { value: 'meter', label: 'Meter (m)', category: 'Measurement', example: 'Fabric, electric wire, cable, rope' },
    { value: 'linear meter', label: 'Linear Meter (l.m.)', category: 'Measurement', example: 'Piping, gutters, roofing sheets' },
    { value: 'yard', label: 'Yard (yd)', category: 'Measurement', example: 'Cloth, textile, canvas' },
    { value: 'sq.m.', label: 'Square Meter (sq.m.)', category: 'Measurement', example: 'Tarpaulin, carpet, glass' },
    { value: 'cu.m.', label: 'Cubic Meter (cu.m.)', category: 'Measurement', example: 'Sand, gravel, boulders, soil' },

    { value: 'pax', label: 'Pax (Person)', category: 'Catering / Events', example: 'Catering, seminar package, training' },
    { value: 'meal', label: 'Meal', category: 'Catering / Events', example: 'Breakfast, lunch, dinner, snacks' },
    { value: 'serving', label: 'Serving', category: 'Catering / Events', example: 'Buffet serving, dish portion' },
    { value: 'plate', label: 'Plate', category: 'Catering / Events', example: 'Plated meal package' },

    { value: 'bar', label: 'Bar', category: 'Construction', example: 'Deformed rebar, flat bar, angle bar' },
    { value: 'length', label: 'Length', category: 'Construction', example: 'PVC pipe, steel conduit, G.I. pipe' },
    { value: 'board', label: 'Board (bd.ft.)', category: 'Construction', example: 'Lumber, plywood, gypsum board' },
    { value: 'panel', label: 'Panel', category: 'Construction', example: 'Solar panel, acoustic board, partition' },
    { value: 'spool', label: 'Spool', category: 'Hardware', example: 'Thread, wire, trimmer line' },
];

const STORAGE_KEY = 'eproc_custom_attachment_units';

export const AttachmentUnitCombobox = ({
    value = '',
    onChange,
    placeholder = 'Select or type unit...',
    disabled = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [customUnits, setCustomUnits] = useState([]);
    const [newCustomUnitInput, setNewCustomUnitInput] = useState('');
    const [showAddCustomInput, setShowAddCustomInput] = useState(false);
    const [coords, setCoords] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const popoverWidth = 270;
        const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;

        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - popoverWidth - 12);
        }

        setCoords({
            left,
            width: popoverWidth,
            openUpward,
            top: openUpward ? undefined : rect.bottom + 4,
            bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
            maxHeight: openUpward ? Math.min(320, spaceAbove - 16) : Math.min(320, spaceBelow - 16),
        });
    }, []);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setCustomUnits(parsed);
                }
            }
        } catch (e) {
            console.error('Failed to parse custom units from storage', e);
        }
    }, []);

    useEffect(() => {
        const handleCustomUnitsUpdated = (e) => {
            if (e.detail?.customUnits && Array.isArray(e.detail.customUnits)) {
                setCustomUnits(e.detail.customUnits);
            }
        };
        window.addEventListener('attachment-units:updated', handleCustomUnitsUpdated);
        return () => window.removeEventListener('attachment-units:updated', handleCustomUnitsUpdated);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();

        const handleScrollOrResize = () => {
            if (triggerRef.current) {
                updatePosition();
            }
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
            const inMenu = menuRef.current && menuRef.current.contains(e.target);
            if (!inTrigger && !inMenu) {
                setIsOpen(false);
                setShowAddCustomInput(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setShowAddCustomInput(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSaveCustomUnit = (unitName) => {
        const cleanName = (unitName || '').trim();
        if (!cleanName) return;

        const existsInDefault = DEFAULT_PROCUREMENT_UNITS.some(
            u => u.value.toLowerCase() === cleanName.toLowerCase() || u.label.toLowerCase() === cleanName.toLowerCase()
        );

        let updatedList = [...customUnits];
        if (!existsInDefault && !customUnits.some(u => u.value.toLowerCase() === cleanName.toLowerCase())) {
            const newEntry = {
                value: cleanName,
                label: cleanName,
                category: 'Custom Units',
                example: 'User-defined customized unit',
                isCustom: true,
            };
            updatedList = [newEntry, ...customUnits];
            setCustomUnits(updatedList);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
                window.dispatchEvent(new CustomEvent('attachment-units:updated', { detail: { customUnits: updatedList } }));
            } catch (err) {
                console.error('Failed to save custom unit', err);
            }
        }

        onChange(cleanName);
        setSearchTerm('');
        setNewCustomUnitInput('');
        setShowAddCustomInput(false);
        setIsOpen(false);
    };

    const handleRemoveCustomUnit = (unitValue, e) => {
        e.stopPropagation();
        const updated = customUnits.filter(u => u.value !== unitValue);
        setCustomUnits(updated);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('attachment-units:updated', { detail: { customUnits: updated } }));
        } catch (err) {
            console.error('Failed to update custom units', err);
        }
    };

    const allUnits = useMemo(() => {
        return [...customUnits, ...DEFAULT_PROCUREMENT_UNITS];
    }, [customUnits]);

    const filteredUnits = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return allUnits;
        return allUnits.filter(u => {
            const val = (u.value || '').toLowerCase();
            const lbl = (u.label || '').toLowerCase();
            const cat = (u.category || '').toLowerCase();
            const ex = (u.example || '').toLowerCase();
            return val.includes(term) || lbl.includes(term) || cat.includes(term) || ex.includes(term);
        });
    }, [allUnits, searchTerm]);

    const isExactMatch = allUnits.some(
        u => u.value.toLowerCase() === searchTerm.trim().toLowerCase()
    );

    const handleOpen = () => {
        if (disabled) return;
        updatePosition();
        setIsOpen(true);
    };

    return (
        <div className={`relative ${className}`} ref={triggerRef}>
            <div className="relative flex items-center">
                <input
                    type="text"
                    disabled={disabled}
                    value={value || ''}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setSearchTerm(e.target.value);
                        if (!isOpen) handleOpen();
                    }}
                    onFocus={() => {
                        setSearchTerm('');
                        handleOpen();
                    }}
                    placeholder={placeholder}
                    className="w-full px-2 py-1.5 pr-12 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white text-slate-800 font-medium shadow-xs"
                />

                <div className="absolute right-1 flex items-center gap-0.5">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearchTerm('');
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                            title="Clear unit"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isOpen) {
                                setIsOpen(false);
                            } else {
                                setSearchTerm('');
                                handleOpen();
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                        title="Toggle unit list"
                    >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {isOpen && !disabled && coords && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: coords.top !== undefined ? `${coords.top}px` : 'auto',
                        bottom: coords.bottom !== undefined ? `${coords.bottom}px` : 'auto',
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999,
                    }}
                    className="bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100 text-left"
                >

                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 shrink-0">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search unit or example item..."
                            className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-800 placeholder-slate-400"
                            autoFocus
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="text-[10px] text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded hover:bg-slate-200"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {searchTerm.trim() && !isExactMatch && (
                        <div className="p-1.5 bg-blue-50/80 border-b border-blue-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleSaveCustomUnit(searchTerm)}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-blue-700 hover:bg-blue-100/70 rounded transition font-medium"
                            >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                    Use custom unit: <strong className="font-bold underline">"{searchTerm.trim()}"</strong>
                                </span>
                            </button>
                        </div>
                    )}

                    <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                        {filteredUnits.length === 0 ? (
                            <div className="p-4 text-center text-slate-400">
                                <p>No matching unit found.</p>
                                <button
                                    type="button"
                                    onClick={() => handleSaveCustomUnit(searchTerm)}
                                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 transition"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add "{searchTerm.trim()}" as custom unit
                                </button>
                            </div>
                        ) : (
                            filteredUnits.map((u, i) => {
                                const isSelected = value?.toLowerCase() === u.value.toLowerCase();
                                return (
                                    <button
                                        key={`${u.value}-${i}`}
                                        type="button"
                                        onClick={() => {
                                            onChange(u.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-2.5 py-2 text-left flex items-start justify-between gap-2 hover:bg-slate-50 transition group ${
                                            isSelected ? 'bg-blue-50/80 text-blue-900 font-semibold' : 'text-slate-700'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`font-mono text-xs font-bold px-1.5 py-0.2 rounded border ${
                                                    u.isCustom
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-slate-100 text-slate-800 border-slate-200'
                                                }`}>
                                                    {u.value}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-800">
                                                    {u.label !== u.value ? u.label : ''}
                                                </span>
                                                <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded">
                                                    {u.category}
                                                </span>
                                            </div>
                                            {u.example && (
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate italic">
                                                    e.g. {u.example}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                            {u.isCustom && (
                                                <button
                                                    type="button"
                                                    title="Delete this custom unit"
                                                    onClick={(e) => handleRemoveCustomUnit(u.value, e)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 rounded transition"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="p-2 bg-slate-50 border-t border-slate-100 shrink-0">
                        {showAddCustomInput ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={newCustomUnitInput}
                                    onChange={(e) => setNewCustomUnitInput(e.target.value)}
                                    placeholder="Enter custom unit (e.g. tray)..."
                                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveCustomUnit(newCustomUnitInput);
                                        } else if (e.key === 'Escape') {
                                            setShowAddCustomInput(false);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleSaveCustomUnit(newCustomUnitInput)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddCustomInput(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowAddCustomInput(true)}
                                className="w-full flex items-center justify-center gap-1 py-1 px-2 text-slate-600 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-300 rounded text-[11px] font-medium transition shadow-xs"
                            >
                                <Plus className="w-3 h-3 text-blue-600" />
                                <span>Add customize unit</span>
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
