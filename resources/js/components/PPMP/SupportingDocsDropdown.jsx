import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    FileCheck2,
    ChevronDown,
    Check,
    Plus,
    X,
    Search,
    FileText,
} from 'lucide-react';

const DEFAULT_FALLBACK_DOCS = [
    { id: 'def_1', name: '3 Pre Canvass', description: 'At least three canvass price quotations' },
    { id: 'def_2', name: 'Market Scoping', description: 'Market price analysis / scoping report' },
    { id: 'def_3', name: 'Latest PO', description: 'Copy of latest purchase order' },
    { id: 'def_4', name: 'List of Attachment', description: 'Summary list of all project attachments' },
    { id: 'def_5', name: 'Activity Design / Project Proposal', description: 'Approved activity design or proposal' },
    { id: 'def_6', name: 'Technical Specifications', description: 'Detailed technical specifications sheet' },
    { id: 'def_7', name: 'Purchase Request (PR)', description: 'Signed purchase request' },
];

export const SupportingDocsDropdown = ({
    value = '',
    onChange,
    documents = [],
    disabled = false,
    placeholder = 'Select supporting docs...',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customInput, setCustomInput] = useState('');
    const [coords, setCoords] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    // Calculate menu position relative to viewport
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUpward = spaceBelow < 330 && spaceAbove > spaceBelow;

        const popoverWidth = 320;
        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - popoverWidth - 12);
        }

        setCoords({
            left,
            width: popoverWidth,
            openUpward,
            top: openUpward ? undefined : rect.bottom + 6,
            bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
            maxHeight: openUpward ? Math.min(420, spaceAbove - 16) : Math.min(420, spaceBelow - 16),
        });
    }, []);

    // Toggle dropdown open
    const handleToggleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Close on click outside or escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            const inTrigger = triggerRef.current && triggerRef.current.contains(event.target);
            const inMenu = menuRef.current && menuRef.current.contains(event.target);
            if (!inTrigger && !inMenu) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
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

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleScrollOrResize);
            window.removeEventListener('scroll', handleScrollOrResize, true);
        };
    }, [isOpen, updatePosition]);

    // Active options list
    const docOptions = useMemo(() => {
        if (Array.isArray(documents) && documents.length > 0) {
            return documents;
        }
        return DEFAULT_FALLBACK_DOCS;
    }, [documents]);

    // Parse value into array of selected names
    const selectedList = useMemo(() => {
        if (!value) return [];
        return String(value)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }, [value]);

    // Toggle a document by name
    const handleToggleDoc = (docName) => {
        const trimmed = docName.trim();
        if (!trimmed) return;

        let updated;
        const exists = selectedList.some(
            (item) => item.toLowerCase() === trimmed.toLowerCase()
        );

        if (exists) {
            updated = selectedList.filter(
                (item) => item.toLowerCase() !== trimmed.toLowerCase()
            );
        } else {
            updated = [...selectedList, trimmed];
        }

        onChange(updated.join(', '));
    };

    // Add custom document
    const handleAddCustom = (e) => {
        if (e) e.preventDefault();
        const trimmed = customInput.trim();
        if (!trimmed) return;

        const exists = selectedList.some(
            (item) => item.toLowerCase() === trimmed.toLowerCase()
        );

        if (!exists) {
            const updated = [...selectedList, trimmed];
            onChange(updated.join(', '));
        }
        setCustomInput('');
    };

    // Remove specific item directly
    const handleRemove = (e, itemToRemove) => {
        e.stopPropagation();
        const updated = selectedList.filter(
            (item) => item.toLowerCase() !== itemToRemove.toLowerCase()
        );
        onChange(updated.join(', '));
    };

    // Clear all selections
    const handleClearAll = (e) => {
        if (e) e.stopPropagation();
        onChange('');
    };

    // Filtered options based on search query
    const filteredOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return docOptions;
        return docOptions.filter(
            (doc) =>
                doc.name.toLowerCase().includes(q) ||
                (doc.description && doc.description.toLowerCase().includes(q))
        );
    }, [docOptions, searchQuery]);

    // Identify custom selections not in the official options
    const customSelections = useMemo(() => {
        const officialNames = new Set(docOptions.map((d) => d.name.toLowerCase()));
        return selectedList.filter((name) => !officialNames.has(name.toLowerCase()));
    }, [selectedList, docOptions]);

    return (
        <div className="relative inline-block w-full">
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={handleToggleOpen}
                className={`w-full min-h-[38px] p-1.5 border rounded-lg text-left transition flex items-center justify-between gap-1.5 text-xs bg-white ${
                    isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-300 hover:border-slate-400 shadow-2xs'
                } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                title={selectedList.length > 0 ? selectedList.join(', ') : placeholder}
            >
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 pr-1">
                    {selectedList.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-slate-400 py-0.5">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                            <span className="italic truncate">{placeholder}</span>
                        </div>
                    ) : (
                        <>
                            {selectedList.slice(0, 1).map((name, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 max-w-[130px] truncate"
                                >
                                    <FileCheck2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{name}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleRemove(e, name)}
                                        className="text-blue-400 hover:text-blue-700 p-0.5 hover:bg-blue-100 rounded cursor-pointer"
                                        title={`Remove ${name}`}
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </span>
                            ))}
                            {selectedList.length > 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    +{selectedList.length - 1} more
                                </span>
                            )}
                        </>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    {selectedList.length > 0 && !disabled && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Clear all selections"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
                </div>
            </button>

            {/* Render Dropdown Menu via Portal into document.body to avoid table overflow clipping and z-index issues */}
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
                        zIndex: 99999,
                    }}
                    className="bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <FileCheck2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="font-bold text-xs">Attached Supporting Documents</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedList.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-bold border border-blue-400/30">
                                    {selectedList.length} selected
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Filter & Clear Subheader */}
                    <div className="p-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center gap-2 shrink-0">
                        <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Filter options..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        {selectedList.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline px-1 cursor-pointer shrink-0"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Checkbox Options List */}
                    <div className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-slate-100">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-[11px] italic">
                                No matching documents found.
                            </div>
                        ) : (
                            filteredOptions.map((doc) => {
                                const isChecked = selectedList.some(
                                    (item) => item.toLowerCase() === doc.name.toLowerCase()
                                );
                                return (
                                    <label
                                        key={doc.id || doc.name}
                                        className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition select-none ${
                                            isChecked
                                                ? 'bg-blue-50/90 text-blue-950 border border-blue-200/80 shadow-2xs'
                                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleDoc(doc.name)}
                                            className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-xs leading-snug">
                                                {doc.name}
                                            </div>
                                            {doc.description && (
                                                <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                                    {doc.description}
                                                </div>
                                            )}
                                        </div>
                                        {isChecked && (
                                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                        )}
                                    </label>
                                );
                            })
                        )}

                        {/* Any Custom Selections previously typed */}
                        {customSelections.length > 0 && (
                            <div className="pt-2 mt-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                                    Custom / Other Documents
                                </div>
                                {customSelections.map((customName, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 text-slate-800 text-xs border border-slate-200/60 mb-1"
                                    >
                                        <span className="font-semibold truncate">{customName}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemove(e, customName)}
                                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                            title="Remove"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Custom / Other Document Form */}
                    <form
                        onSubmit={handleAddCustom}
                        className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center gap-1.5 shrink-0"
                    >
                        <input
                            type="text"
                            placeholder="Add other document / attachment..."
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!customInput.trim()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                        >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                        </button>
                    </form>

                    {/* Footer Actions */}
                    <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                        <span className="text-[11px] text-slate-500 font-medium">
                            {selectedList.length} of {docOptions.length} checked
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>Done</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
