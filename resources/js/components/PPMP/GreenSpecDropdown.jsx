import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Leaf,
    Search,
    ChevronDown,
    Check,
    Plus,
    X,
    Sparkles,
    Tag,
    FileText,
    Layers,
    PenLine,
    ShieldAlert,
} from 'lucide-react';

export const GreenSpecDropdown = ({
    terms = [],
    selectedTermId = '',
    currentText = '',
    onSelectTerm,
    onAppendTerm,
    onClear,
    isPolCondition = false,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);

            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const selectedTerm = useMemo(() => {
        if (!selectedTermId || selectedTermId === 'CUSTOM') return null;
        return terms.find((t) => String(t.id) === String(selectedTermId)) || null;
    }, [selectedTermId, terms]);

    const categoryCounts = useMemo(() => {
        const counts = { ALL: terms.length, CSE: 0, 'NON-CSE': 0, GENERAL: 0 };
        terms.forEach((t) => {
            const cat = (t.category || '').toUpperCase();
            if (cat === 'CSE') counts.CSE += 1;
            else if (cat === 'NON-CSE') counts['NON-CSE'] += 1;
            else counts.GENERAL += 1;
        });
        return counts;
    }, [terms]);

    const filteredTerms = useMemo(() => {
        return terms.filter((term) => {
            const matchesCategory =
                selectedCategory === 'ALL' ||
                (term.category && term.category.toUpperCase() === selectedCategory.toUpperCase());

            const query = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !query ||
                term.name.toLowerCase().includes(query) ||
                (term.category && term.category.toLowerCase().includes(query)) ||
                (term.description && term.description.toLowerCase().includes(query));

            return matchesCategory && matchesSearch;
        });
    }, [terms, selectedCategory, searchQuery]);

    const groupedTerms = useMemo(() => {
        const groups = {
            CSE: [],
            'NON-CSE': [],
            GENERAL: [],
        };
        filteredTerms.forEach((term) => {
            const cat = (term.category || '').toUpperCase();
            if (cat === 'CSE') groups.CSE.push(term);
            else if (cat === 'NON-CSE') groups['NON-CSE'].push(term);
            else groups.GENERAL.push(term);
        });
        return groups;
    }, [filteredTerms]);

    const handleSelect = (term) => {
        if (onSelectTerm) {
            onSelectTerm(term);
        }
        setIsOpen(false);
    };

    const handleAppend = (e, term) => {
        e.stopPropagation();
        if (onAppendTerm) {
            onAppendTerm(term);
        }
        setIsOpen(false);
    };

    const handleChooseCustom = () => {
        if (onSelectTerm) {
            onSelectTerm({ id: 'CUSTOM', name: 'Custom Terms' });
        }
        setIsOpen(false);
    };

    const cleanName = (name = '') => name.replace(/^Green Spec:\s*/i, '');

    const getCategoryPill = (category) => {
        const cat = (category || '').toUpperCase();
        if (cat === 'CSE') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                    <Leaf className="w-2.5 h-2.5 text-emerald-600" /> CSE
                </span>
            );
        }
        if (cat === 'NON-CSE') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100/80 text-blue-800 border border-blue-200">
                    <Sparkles className="w-2.5 h-2.5 text-blue-600" /> Non-CSE
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Tag className="w-2.5 h-2.5 text-slate-500" /> General
            </span>
        );
    };

    return (
        <div ref={dropdownRef} className="relative w-full">

            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full group text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs transition shadow-2xs ${
                    isOpen
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white'
                        : isPolCondition
                        ? 'bg-blue-50/60 border-blue-300 text-slate-800 hover:border-blue-400'
                        : selectedTerm
                        ? 'bg-emerald-50/50 border-emerald-300 hover:border-emerald-400 text-slate-900'
                        : selectedTermId === 'CUSTOM'
                        ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400 text-slate-900'
                        : 'bg-white border-slate-300 hover:border-slate-400 text-slate-600'
                } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition ${
                            selectedTerm
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : selectedTermId === 'CUSTOM'
                                ? 'bg-amber-500 text-white'
                                : isPolCondition
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200'
                        }`}
                    >
                        {selectedTermId === 'CUSTOM' ? (
                            <PenLine className="w-3.5 h-3.5" />
                        ) : isPolCondition ? (
                            <ShieldAlert className="w-3.5 h-3.5" />
                        ) : (
                            <Leaf className="w-3.5 h-3.5" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1 truncate">
                        {selectedTerm ? (
                            <div className="flex items-center gap-1.5 truncate">
                                <span className="font-bold text-slate-900 text-xs truncate">
                                    {cleanName(selectedTerm.name)}
                                </span>
                                {getCategoryPill(selectedTerm.category)}
                            </div>
                        ) : selectedTermId === 'CUSTOM' ? (
                            <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs truncate">
                                <span>Custom / Manual Specifications</span>
                                <span className="text-[10px] font-normal text-amber-700">(Customized)</span>
                            </div>
                        ) : (
                            <span className="text-slate-500 font-medium text-xs">
                                Choose Green Spec / Other Term...
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {(selectedTerm || (selectedTermId === 'CUSTOM' && currentText)) && !disabled && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onClear) onClear();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    if (onClear) onClear();
                                }
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                            title="Clear selection"
                        >
                            <X className="w-3.5 h-3.5" />
                        </span>
                    )}
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-emerald-600' : 'group-hover:text-slate-600'
                        }`}
                    />
                </div>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[320px] max-w-full">

                    <div className="p-2.5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 space-y-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search green specs (e.g. paper, chairs, laptop)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
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

                        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('ALL')}
                                className={`px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    selectedCategory === 'ALL'
                                        ? 'bg-slate-900 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                All ({categoryCounts.ALL})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('CSE')}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    selectedCategory === 'CSE'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                                }`}
                            >
                                <Leaf className="w-2.5 h-2.5" /> CSE ({categoryCounts.CSE})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('NON-CSE')}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    selectedCategory === 'NON-CSE'
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
                                }`}
                            >
                                <Sparkles className="w-2.5 h-2.5" /> Non-CSE ({categoryCounts['NON-CSE']})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('GENERAL')}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold transition shrink-0 cursor-pointer ${
                                    selectedCategory === 'GENERAL'
                                        ? 'bg-slate-700 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                <Tag className="w-2.5 h-2.5" /> General ({categoryCounts.GENERAL})
                            </button>
                        </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 overscroll-contain">
                        {filteredTerms.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 space-y-1">
                                <Search className="w-6 h-6 mx-auto text-slate-300 stroke-1" />
                                <div className="text-xs font-semibold text-slate-600">No specifications found</div>
                                <div className="text-[11px] text-slate-400">
                                    No matches for "{searchQuery}". You can enter custom terms below.
                                </div>
                            </div>
                        ) : (
                            <>

                                {groupedTerms.CSE.length > 0 && (
                                    <div className="bg-white">
                                        <div className="sticky top-0 z-10 px-3 py-1.5 bg-emerald-50/90 backdrop-blur-xs border-y border-emerald-100 text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Leaf className="w-3 h-3 text-emerald-600" />
                                                A. Common-Use Supplies &amp; Equipment (CSE)
                                            </span>
                                            <span className="font-bold text-emerald-600">
                                                {groupedTerms.CSE.length} items
                                            </span>
                                        </div>
                                        {groupedTerms.CSE.map((term) => renderTermItem(term))}
                                    </div>
                                )}

                                {groupedTerms['NON-CSE'].length > 0 && (
                                    <div className="bg-white">
                                        <div className="sticky top-0 z-10 px-3 py-1.5 bg-blue-50/90 backdrop-blur-xs border-y border-blue-100 text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Sparkles className="w-3 h-3 text-blue-600" />
                                                B. Non-Common Supplies &amp; Equipment (NON-CSE)
                                            </span>
                                            <span className="font-bold text-blue-600">
                                                {groupedTerms['NON-CSE'].length} items
                                            </span>
                                        </div>
                                        {groupedTerms['NON-CSE'].map((term) => renderTermItem(term))}
                                    </div>
                                )}

                                {groupedTerms.GENERAL.length > 0 && (
                                    <div className="bg-white">
                                        <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-100/90 backdrop-blur-xs border-y border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Tag className="w-3 h-3 text-slate-500" />
                                                General &amp; Operational Clauses
                                            </span>
                                            <span className="font-bold text-slate-600">
                                                {groupedTerms.GENERAL.length} items
                                            </span>
                                        </div>
                                        {groupedTerms.GENERAL.map((term) => renderTermItem(term))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={handleChooseCustom}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                selectedTermId === 'CUSTOM'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <PenLine className="w-3.5 h-3.5 text-amber-600" />
                            <span>Custom / Other text entry...</span>
                        </button>

                        <span className="text-[10px] text-slate-400 font-medium">
                            {terms.length} total options
                        </span>
                    </div>
                </div>
            )}
        </div>
    );

    function renderTermItem(term) {
        const isSelected = String(selectedTermId) === String(term.id);
        const firstLinePreview = (term.description || '')
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .slice(0, 2)
            .join(' • ')
            .replace(/^-\s*/, '');

        return (
            <div
                key={term.id}
                onClick={() => handleSelect(term)}
                className={`group p-2.5 hover:bg-emerald-50/70 transition cursor-pointer flex items-start justify-between gap-2.5 border-b border-slate-50 last:border-b-0 ${
                    isSelected ? 'bg-emerald-50/90 border-l-4 border-l-emerald-600' : ''
                }`}
            >
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-xs font-bold ${
                                isSelected ? 'text-emerald-900 font-black' : 'text-slate-800 group-hover:text-emerald-950'
                            }`}
                        >
                            {cleanName(term.name)}
                        </span>
                        {getCategoryPill(term.category)}
                        {isSelected && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                                <Check className="w-2.5 h-2.5" /> Selected
                            </span>
                        )}
                    </div>
                    {firstLinePreview && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug group-hover:text-slate-700">
                            {firstLinePreview}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {currentText && !isSelected && (
                        <button
                            type="button"
                            onClick={(e) => handleAppend(e, term)}
                            className="hidden group-hover:inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 text-[10px] font-bold border border-emerald-300 shadow-2xs transition cursor-pointer"
                            title="Append this specification to existing notes"
                        >
                            <Plus className="w-2.5 h-2.5" /> Append
                        </button>
                    )}
                    {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3" />
                        </div>
                    ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 group-hover:border-emerald-400 group-hover:bg-white flex items-center justify-center transition">
                            <Plus className="w-3 h-3 text-slate-300 group-hover:text-emerald-600" />
                        </div>
                    )}
                </div>
            </div>
        );
    }
};

export default GreenSpecDropdown;
