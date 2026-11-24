import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Check,
    Loader2,
    Shield,
    UserCheck,
    AlertCircle,
    Send,
    RefreshCw,
    Sparkles,
    Briefcase,
    CheckCircle2,
    FileSpreadsheet,
    Landmark,
    Building2,
    Compass,
    Info,
    Lock,
    Search,
    ChevronDown,
    Star,
    Tag
} from 'lucide-react';
import { ppmpService } from '../../services/api';
import { UserAvatar } from '../UI/UserAvatar';

const SearchableReviewerSelect = ({
    value,
    onChange,
    options = [],
    disabled = false,
    placeholder = 'Search or select reviewer...',
    emptyLabel = 'No reviewers found',
    isTwg = false,
    ppmpAccountCode = '',
    ppmpAccountName = '',
    accentColor = 'amber',
    required = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [coords, setCoords] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    const selectedOption = useMemo(() => {
        if (!value) return null;
        return options.find(opt => String(opt.id) === String(value)) || null;
    }, [value, options]);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const estimatedHeight = 340;
        const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

        const targetWidth = Math.min(Math.max(rect.width, 380), window.innerWidth - 24);
        let left = rect.left;
        if (left + targetWidth > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - targetWidth - 12);
        }
        if (left < 12) left = 12;

        const maxHeight = openUpward
            ? Math.min(380, Math.max(180, spaceAbove - 24))
            : Math.min(380, Math.max(180, spaceBelow - 24));

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
        if (!isOpen) return;

        updatePosition();

        const handleClickOutside = (e) => {
            const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
            const inMenu = menuRef.current && menuRef.current.contains(e.target);
            if (!inTrigger && !inMenu) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchQuery('');
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
        }, 50);

        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleScrollOrResize);
            window.removeEventListener('scroll', handleScrollOrResize, true);
        };
    }, [isOpen, updatePosition]);

    const filteredOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return options;

        return options.filter(opt => {
            const nameMatch = opt.name && opt.name.toLowerCase().includes(q);
            const desigMatch = opt.designation && opt.designation.toLowerCase().includes(q);
            const emailMatch = opt.email && opt.email.toLowerCase().includes(q);
            const roleMatch = opt.role && opt.role.toLowerCase().includes(q);

            let codeMatch = false;
            if (Array.isArray(opt.account_codes)) {
                codeMatch = opt.account_codes.some(c =>
                    (c.code && c.code.toLowerCase().includes(q)) ||
                    (c.name && c.name.toLowerCase().includes(q))
                );
            }

            return nameMatch || desigMatch || emailMatch || roleMatch || codeMatch;
        });
    }, [options, searchQuery]);

    const { recommendedGroup, otherGroup } = useMemo(() => {
        if (!isTwg) {
            return { recommendedGroup: [], otherGroup: filteredOptions };
        }
        const rec = [];
        const oth = [];
        filteredOptions.forEach(opt => {
            if (opt.matches_ppmp_account_code) {
                rec.push(opt);
            } else {
                oth.push(opt);
            }
        });
        return { recommendedGroup: rec, otherGroup: oth };
    }, [isTwg, filteredOptions]);

    const handleSelect = (opt) => {
        onChange(String(opt.id), opt);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('', null);
    };

    const borderActive = accentColor === 'emerald'
        ? 'border-emerald-500 ring-2 ring-emerald-200'
        : accentColor === 'indigo'
        ? 'border-indigo-500 ring-2 ring-indigo-200'
        : 'border-amber-500 ring-2 ring-amber-200';

    const bgDefault = accentColor === 'emerald'
        ? 'bg-white hover:border-emerald-400'
        : accentColor === 'indigo'
        ? 'bg-white hover:border-indigo-400'
        : 'bg-white hover:border-amber-400';

    return (
        <div className="relative w-full">

            <div
                ref={triggerRef}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen);
                    }
                }}
                className={`w-full min-h-[46px] px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2.5 transition select-none shadow-2xs ${
                    disabled
                        ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed opacity-90'
                        : isOpen
                        ? `${bgDefault} ${borderActive} cursor-pointer`
                        : `${bgDefault} border-slate-300 hover:shadow-xs cursor-pointer`
                }`}
            >
                {selectedOption ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                            }}
                            className="shrink-0"
                        >
                            <UserAvatar
                                user={selectedOption}
                                size="sm"
                                className="shrink-0 border border-slate-200"
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">
                                    {selectedOption.name}
                                </span>
                                {isTwg && selectedOption.matches_ppmp_account_code && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300">
                                        <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                        Recommended
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                                <span>{selectedOption.designation || selectedOption.role || 'Reviewer'}</span>
                                {isTwg && selectedOption.account_codes?.length > 0 && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        ({selectedOption.account_codes.length} Codes)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-slate-400 flex-1">
                        <Search className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="text-xs truncate">{placeholder}</span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                    {!disabled && selectedOption && !required && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition"
                            title="Clear selection"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-slate-600' : ''
                    }`} />
                </div>
            </div>

            {isOpen && coords && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        left: coords.left,
                        width: coords.width,
                        top: coords.top,
                        bottom: coords.bottom,
                        maxHeight: coords.maxHeight,
                    }}
                    className="z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                >

                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
                        <div className="relative flex items-center">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={isTwg ? 'Search reviewer name, designation, or account code...' : 'Search reviewer name or designation...'}
                                className="w-full text-xs pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 pt-1.5">
                            <span>
                                Showing <strong>{filteredOptions.length}</strong> of {options.length} specialists
                            </span>
                            {isTwg && ppmpAccountCode && (
                                <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    PPMP Code: {ppmpAccountCode}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">

                        {isTwg && recommendedGroup.length > 0 && (
                            <div className="bg-emerald-50/50">
                                <div className="px-3 py-1.5 bg-emerald-100/70 border-y border-emerald-200 text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Recommended for this PPMP (Matches Account Code)</span>
                                </div>
                                {recommendedGroup.map(opt => {
                                    const isSelected = String(opt.id) === String(value);
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => handleSelect(opt)}
                                            className={`p-3 cursor-pointer transition flex items-start gap-3 ${
                                                isSelected
                                                    ? 'bg-emerald-100/90 text-emerald-950 font-medium'
                                                    : 'hover:bg-emerald-50/90'
                                            }`}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsOpen(false);
                                                }}
                                                className="shrink-0"
                                            >
                                                <UserAvatar
                                                    user={opt}
                                                    size="md"
                                                    className="shrink-0 border-2 border-emerald-400 mt-0.5"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-slate-900 text-xs">
                                                            {opt.name}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                                            <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                                            Recommended Match
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-[11px] text-slate-600 mt-0.5">
                                                    {opt.designation || 'BAC-TWG Specialist'}
                                                </p>

                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {opt.account_codes?.map((ac) => {
                                                        const isMatchingCode =
                                                            (opt.matching_codes && opt.matching_codes.includes(ac.code)) ||
                                                            (ppmpAccountCode && ac.code === ppmpAccountCode);
                                                        return (
                                                            <span
                                                                key={ac.id}
                                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                                                    isMatchingCode
                                                                        ? 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-2xs'
                                                                        : 'bg-white text-slate-600 border-slate-200'
                                                                }`}
                                                                title={ac.name}
                                                            >
                                                                {ac.code} {isMatchingCode ? '★' : ''}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {isTwg && otherGroup.length > 0 && (
                            <div>
                                {recommendedGroup.length > 0 && (
                                    <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                        Other BAC-TWG Specialists
                                    </div>
                                )}
                                {otherGroup.map(opt => {
                                    const isSelected = String(opt.id) === String(value);
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => handleSelect(opt)}
                                            className={`p-3 cursor-pointer transition flex items-start gap-3 ${
                                                isSelected
                                                    ? 'bg-amber-100/80 text-amber-950 font-medium'
                                                    : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsOpen(false);
                                                }}
                                                className="shrink-0"
                                            >
                                                <UserAvatar
                                                    user={opt}
                                                    size="md"
                                                    className="shrink-0 border border-slate-200 mt-0.5"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-slate-900 text-xs truncate">
                                                        {opt.name}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-600 mt-0.5">
                                                    {opt.designation || 'BAC-TWG Specialist'}
                                                </p>
                                                {opt.account_codes?.length > 0 ? (
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {opt.account_codes.slice(0, 3).map(ac => (
                                                            <span
                                                                key={ac.id}
                                                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                                                                title={ac.name}
                                                            >
                                                                {ac.code}
                                                            </span>
                                                        ))}
                                                        {opt.account_codes.length > 3 && (
                                                            <span className="text-[10px] text-slate-400 px-1 py-0.5">
                                                                +{opt.account_codes.length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic block mt-1">
                                                        No account codes assigned
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!isTwg && filteredOptions.length > 0 && (
                            <div>
                                {filteredOptions.map(opt => {
                                    const isSelected = String(opt.id) === String(value);
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => handleSelect(opt)}
                                            className={`p-3 cursor-pointer transition flex items-center gap-3 ${
                                                isSelected
                                                    ? accentColor === 'emerald'
                                                        ? 'bg-emerald-100/80 text-emerald-950 font-medium'
                                                        : 'bg-indigo-100/80 text-indigo-950 font-medium'
                                                    : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsOpen(false);
                                                }}
                                                className="shrink-0"
                                            >
                                                <UserAvatar
                                                    user={opt}
                                                    size="md"
                                                    className="shrink-0 border border-slate-200"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-slate-900 text-xs truncate">
                                                        {opt.name}
                                                    </span>
                                                    {isSelected && (
                                                        <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 ${
                                                            accentColor === 'emerald' ? 'bg-emerald-600' : 'bg-indigo-600'
                                                        }`}>
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                                    <span>{opt.designation || opt.role}</span>
                                                    {opt.role && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                                            {opt.role}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {filteredOptions.length === 0 && (
                            <div className="p-8 text-center text-slate-400 space-y-1">
                                <Search className="w-6 h-6 mx-auto text-slate-300" />
                                <p className="text-xs font-semibold text-slate-600">{emptyLabel}</p>
                                {searchQuery && (
                                    <p className="text-[11px] text-slate-400">
                                        No matches for "<span className="font-medium text-slate-600">{searchQuery}</span>"
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {!required && selectedOption && (
                        <div className="p-2 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={(e) => {
                                    handleClear(e);
                                    setIsOpen(false);
                                }}
                                className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 font-semibold"
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export const ReviewerAssignmentModal = ({
    isOpen,
    onClose,
    ppmp,
    user,
    mode = 'submit',
    onSuccess,
}) => {
    const isAdmin = ['admin', 'super_admin'].includes(user?.role);
    const isCreator = Boolean(user && ppmp && ppmp.created_by === user.id);
    const userRole = user?.role;

    const isTwg = userRole === 'twg';
    const isBudget = ['budget_officer', 'pacco'].includes(userRole);
    const isOppmo = userRole === 'oppmo';

    const isPpmpAppOnly = (ppmp?.amendment_scope || ppmp?.amendment?.amendment_scope) === 'PPMP_APP';
    const isAttachmentOnly = (ppmp?.amendment_scope || ppmp?.amendment?.amendment_scope) === 'ATTACHMENT_LIST';

    const isTwgApproved = Boolean(
        isPpmpAppOnly ||
        ppmp?.twg_approved_at ||
        ppmp?.signatures?.some(s => s.role === 'twg') ||
        ['BUDGET_OFFICER_REVIEW', 'BUDGET_HEAD_REVIEW', 'PACCO_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_REVIEW', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED'].includes(ppmp?.status)
    );
    const isBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ppmp?.pacco_approved_at ||
        ppmp?.signatures?.some(s => ['budget_officer', 'pacco'].includes(s.role)) ||
        ['OPPMO_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED'].includes(ppmp?.status)
    );
    const isOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ppmp?.signatures?.some(s => s.role === 'oppmo') ||
        ['READY_TO_PRINT', 'HEAD_APPROVED'].includes(ppmp?.status)
    );

    const canReassignAll = isAdmin || isCreator;
    const canEditTwg = mode === 'submit' || ((canReassignAll || isTwg) && !isTwgApproved);
    const canEditBudget = mode === 'submit' || ((canReassignAll || isBudget) && !isBudgetApproved);
    const canEditOppmo = mode === 'submit' || ((canReassignAll || isOppmo) && !isOppmoApproved);

    const [loadingData, setLoadingData] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [twgReviewers, setTwgReviewers] = useState([]);
    const [budgetReviewers, setBudgetReviewers] = useState([]);
    const [paccoReviewers, setPaccoReviewers] = useState([]);
    const [oppmoReviewers, setOppmoReviewers] = useState([]);
    const [isTrustFund, setIsTrustFund] = useState(false);
    const [ppmpAccountCode, setPpmpAccountCode] = useState('');
    const [ppmpAccountName, setPpmpAccountName] = useState('');
    const [ppmpProgramName, setPpmpProgramName] = useState(
        (ppmp?.program_name || ppmp?.program_name_ref?.name || ppmp?.programNameRef?.name || ppmp?.programName?.name || '').trim()
    );

    const [selectedTwgId, setSelectedTwgId] = useState('');
    const [selectedBudgetId, setSelectedBudgetId] = useState('');
    const [selectedOppmoId, setSelectedOppmoId] = useState('');
    const [budgetType, setBudgetType] = useState('auto');
    const [reassignReason, setReassignReason] = useState('');

    useEffect(() => {
        if (!isOpen || !ppmp?.uuid) return;

        let isMounted = true;
        setLoadingData(true);
        setErrorMessage('');

        ppmpService.getAvailableReviewers(ppmp.uuid)
            .then(res => {
                if (!isMounted) return;
                const data = res.data;
                setTwgReviewers(data.twg_reviewers || []);
                setBudgetReviewers(data.budget_reviewers || []);
                setPaccoReviewers(data.pacco_reviewers || []);
                setOppmoReviewers(data.oppmo_reviewers || []);
                setIsTrustFund(Boolean(data.is_trust_fund));
                setPpmpAccountCode(data.ppmp_account_code || '');
                setPpmpAccountName(data.ppmp_account_name || '');
                if (data.ppmp_program_name) {
                    setPpmpProgramName(data.ppmp_program_name.trim());
                }

                const assigned = data.assigned_reviewers || {};

                if (assigned.twg_reviewer_id) {
                    setSelectedTwgId(String(assigned.twg_reviewer_id));
                } else if (ppmp.twg_reviewer_id) {
                    setSelectedTwgId(String(ppmp.twg_reviewer_id));
                } else if (data.twg_reviewers?.length > 0) {
                    const match = data.twg_reviewers.find(t => t.matches_ppmp_account_code);
                    setSelectedTwgId(String(match ? match.id : data.twg_reviewers[0].id));
                }

                if (assigned.budget_reviewer_id) {
                    setSelectedBudgetId(String(assigned.budget_reviewer_id));
                } else if (ppmp.budget_reviewer_id) {
                    setSelectedBudgetId(String(ppmp.budget_reviewer_id));
                } else {
                    if (data.is_trust_fund && data.pacco_reviewers?.length > 0) {
                        setSelectedBudgetId(String(data.pacco_reviewers[0].id));
                    } else if (data.budget_reviewers?.length > 0) {
                        setSelectedBudgetId(String(data.budget_reviewers[0].id));
                    }
                }

                if (assigned.oppmo_reviewer_id) {
                    setSelectedOppmoId(String(assigned.oppmo_reviewer_id));
                } else if (ppmp.oppmo_reviewer_id) {
                    setSelectedOppmoId(String(ppmp.oppmo_reviewer_id));
                } else if (data.oppmo_reviewers?.length > 0) {
                    setSelectedOppmoId(String(data.oppmo_reviewers[0].id));
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.error('Failed to load available reviewers:', err);
                setErrorMessage(err.response?.data?.message || 'Failed to load available reviewers.');
            })
            .finally(() => {
                if (isMounted) setLoadingData(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, ppmp?.uuid]);

    const activeBudgetReviewersList = useMemo(() => {
        if (budgetType === 'pacco') return paccoReviewers;
        if (budgetType === 'budget') return budgetReviewers;
        return isTrustFund ? paccoReviewers : budgetReviewers;
    }, [budgetType, isTrustFund, paccoReviewers, budgetReviewers]);

    const currentTwg = useMemo(() => {
        return twgReviewers.find(t => String(t.id) === String(selectedTwgId)) || null;
    }, [twgReviewers, selectedTwgId]);

    const recommendedTwg = useMemo(() => {
        return twgReviewers.find(t => t.matches_ppmp_account_code) || null;
    }, [twgReviewers]);

    const currentBudget = useMemo(() => {
        return activeBudgetReviewersList.find(b => String(b.id) === String(selectedBudgetId)) || null;
    }, [activeBudgetReviewersList, selectedBudgetId]);

    const currentOppmo = useMemo(() => {
        return oppmoReviewers.find(o => String(o.id) === String(selectedOppmoId)) || null;
    }, [oppmoReviewers, selectedOppmoId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!isPpmpAppOnly && !selectedTwgId) {
            setErrorMessage('Please select the 1st Pick: BAC-TWG Reviewer.');
            return;
        }

        const payload = {
            twg_reviewer_id: isPpmpAppOnly ? null : (selectedTwgId ? Number(selectedTwgId) : null),
            budget_reviewer_id: isAttachmentOnly ? undefined : (selectedBudgetId ? Number(selectedBudgetId) : null),
            oppmo_reviewer_id: isAttachmentOnly ? undefined : (selectedOppmoId ? Number(selectedOppmoId) : null),
        };

        if (mode === 'reassign' && reassignReason.trim()) {
            payload.reason = reassignReason.trim();
        }

        setSubmitting(true);
        try {
            let res;
            if (mode === 'reassign') {
                res = await ppmpService.reassignReviewers(ppmp.uuid, payload);
            } else {
                res = await ppmpService.submitForReview(ppmp.uuid, payload);
            }

            const updated = res.data?.ppmp || ppmp;
            if (onSuccess) {
                onSuccess(updated, res.data?.message);
            }
            onClose();
        } catch (err) {
            console.error('Failed to submit reviewer assignment:', err);
            setErrorMessage(err.response?.data?.message || 'Failed to process reviewer assignment.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !ppmp) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >

                <div className={`px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-sm gap-3 ${
                    mode === 'reassign'
                        ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800'
                        : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800'
                }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-xs shrink-0">
                            {mode === 'reassign' ? (
                                <RefreshCw className="w-5 h-5 text-amber-200" />
                            ) : (
                                <Send className="w-5 h-5 text-indigo-200" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold tracking-tight text-white truncate">
                                {mode === 'reassign' ? 'Reassign PPMP Reviewers' : 'Select Assigned Reviewers for this PPMP'}
                            </h3>
                            <div className="text-[11px] text-white/90 flex items-center gap-1.5 mt-0.5 min-w-0">
                                <span
                                    className="font-semibold truncate min-w-0 flex-1 block"
                                    title={(ppmpProgramName || ppmp?.program_name || ppmp?.program_name_ref?.name || ppmp?.programNameRef?.name || ppmp?.programName?.name || '').trim() || ppmp?.title || ppmp?.project_title || 'PPMP Procurement Program'}
                                >
                                    {(ppmpProgramName || ppmp?.program_name || ppmp?.program_name_ref?.name || ppmp?.programNameRef?.name || ppmp?.programName?.name || '').trim() || ppmp?.title || ppmp?.project_title || 'PPMP Procurement Program'}
                                </span>
                                {(ppmp?.tracking_number || (ppmp?.ppmp_number && String(ppmp.ppmp_number) !== '0' ? `PPMP No. ${ppmp.ppmp_number}` : (ppmp?.id ? `PPMP #${ppmp.id}` : ''))) && (
                                    <>
                                        <span className="opacity-60 shrink-0">•</span>
                                        <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded text-white shrink-0 font-medium">
                                            {ppmp?.tracking_number || (ppmp?.ppmp_number && String(ppmp.ppmp_number) !== '0' ? `PPMP No. ${ppmp.ppmp_number}` : (ppmp?.id ? `PPMP #${ppmp.id}` : ''))}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer shrink-0 ml-1"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                            {mode === 'reassign' ? (
                                isTwg ? (
                                    <span>As <strong>BAC-TWG Reviewer</strong>, you can reassign to another BAC-TWG reviewer. Other stages are locked.</span>
                                ) : isBudget ? (
                                    <span>As <strong>Budget/PACCO Reviewer</strong>, you can reassign to another Budget/PACCO reviewer. Other stages are locked.</span>
                                ) : isOppmo ? (
                                    <span>As <strong>OPPMO Reviewer</strong>, you can reassign to another OPPMO reviewer. Other stages are locked.</span>
                                ) : (
                                    <span>As <strong>PPMP Preparer / Admin</strong>, you can reassign any of the designated reviewers.</span>
                                )
                            ) : isPpmpAppOnly ? (
                                <span>Review process order (PPMP/APP only): <strong>1. Budget / PACCO</strong> &rarr; <strong>2. OPPMO</strong> &rarr; <strong>Signatories</strong>.</span>
                            ) : isAttachmentOnly ? (
                                <span>Review process order (Detailed Specifications only): <strong>1. BAC-TWG</strong> &rarr; <strong>Office Head</strong>.</span>
                            ) : (
                                <span>Review process order: <strong>1. BAC-TWG</strong> &rarr; <strong>2. Budget / PACCO</strong> &rarr; <strong>3. OPPMO</strong>.</span>
                            )}
                        </span>
                    </div>
                    {ppmpAccountCode && (
                        <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200" title={ppmpAccountName}>
                            Code: {ppmpAccountCode}
                        </span>
                    )}
                </div>

                {errorMessage && (
                    <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 shrink-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
                    {loadingData ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                            <span className="text-xs font-medium">Loading active reviewer specialists...</span>
                        </div>
                    ) : (
                        <>

                            {!isPpmpAppOnly && (
                            <div className={`p-4 rounded-xl border-2 space-y-2.5 transition ${
                                canEditTwg
                                    ? 'border-amber-300 bg-amber-50/40'
                                    : 'border-slate-200 bg-slate-50/60 opacity-85'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${
                                            canEditTwg ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                                        }`}>
                                            1
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                                                    1st Pick: BAC-TWG Reviewer <span className="text-rose-500">*</span>
                                                </h4>
                                                {mode === 'reassign' && isTwgApproved ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Approved
                                                    </span>
                                                ) : !canEditTwg && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                                                        <Lock className="w-2.5 h-2.5" /> Locked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-amber-800">
                                                Technical review of specifications, unit terms, and market scoping.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                                        Technical Stage
                                    </span>
                                </div>

                                <div className="space-y-2 pt-1">

                                    <SearchableReviewerSelect
                                        value={selectedTwgId}
                                        onChange={(newId) => setSelectedTwgId(newId)}
                                        options={twgReviewers}
                                        disabled={!canEditTwg}
                                        placeholder="Search or choose assigned BAC-TWG Reviewer..."
                                        isTwg={true}
                                        ppmpAccountCode={ppmpAccountCode}
                                        ppmpAccountName={ppmpAccountName}
                                        accentColor="amber"
                                        required={true}
                                    />

                                    {canEditTwg && recommendedTwg && String(recommendedTwg.id) !== String(selectedTwgId) && (
                                        <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 shadow-2xs animate-in fade-in duration-200">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span className="truncate">
                                                    <strong>Recommended:</strong> <strong>{recommendedTwg.name}</strong> is assigned to Account Code <strong>{ppmpAccountCode}</strong>.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTwgId(String(recommendedTwg.id))}
                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer transition shrink-0 ml-2"
                                            >
                                                Select Recommended
                                            </button>
                                        </div>
                                    )}

                                    {currentTwg && currentTwg.matches_ppmp_account_code && (
                                        <div className="flex items-center gap-2 p-2 bg-emerald-50/90 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 shadow-2xs">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>
                                                <strong>Domain Match:</strong> <strong>{currentTwg.name}</strong> has official assignment for Account Code <strong>{ppmpAccountCode || 'this domain'}</strong>.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}

                            {!isAttachmentOnly && (
                            <div className={`p-4 rounded-xl border-2 space-y-2.5 transition ${
                                canEditBudget
                                    ? 'border-emerald-300 bg-emerald-50/40'
                                    : 'border-slate-200 bg-slate-50/60 opacity-85'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${
                                            canEditBudget ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
                                        }`}>
                                            {isPpmpAppOnly ? 1 : 2}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                                    {isPpmpAppOnly ? '1st Pick: Budget / PACCO Reviewer' : '2nd Pick: Budget / PACCO Reviewer'}
                                                </h4>
                                                {mode === 'reassign' && isBudgetApproved ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Approved
                                                    </span>
                                                ) : !canEditBudget && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                                                        <Lock className="w-2.5 h-2.5" /> Locked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-emerald-800">
                                                {isTrustFund
                                                    ? 'Trust Fund procurement certification (PACCO Provincial Accountant).'
                                                    : 'Budget appropriation and fund allotment certification (Provincial Budget Officer).'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={!canEditBudget}
                                            onClick={() => setBudgetType('budget')}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                                                (budgetType === 'budget' || (budgetType === 'auto' && !isTrustFund))
                                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                                    : 'bg-white text-slate-600 border border-slate-200'
                                            } ${!canEditBudget ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            Budget (PBO)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canEditBudget}
                                            onClick={() => setBudgetType('pacco')}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                                                (budgetType === 'pacco' || (budgetType === 'auto' && isTrustFund))
                                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                                    : 'bg-white text-slate-600 border border-slate-200'
                                            } ${!canEditBudget ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            PACCO (Accounting)
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-1">

                                    <SearchableReviewerSelect
                                        value={selectedBudgetId}
                                        onChange={(newId) => setSelectedBudgetId(newId)}
                                        options={activeBudgetReviewersList}
                                        disabled={!canEditBudget}
                                        placeholder="Search or choose assigned Budget / PACCO Reviewer..."
                                        accentColor="emerald"
                                    />
                                </div>
                            </div>
                            )}

                            {!isAttachmentOnly && (
                            <div className={`p-4 rounded-xl border-2 space-y-2.5 transition ${
                                canEditOppmo
                                    ? 'border-indigo-300 bg-indigo-50/40'
                                    : 'border-slate-200 bg-slate-50/60 opacity-85'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-xs ${
                                            canEditOppmo ? 'bg-indigo-600 text-white' : 'bg-slate-400 text-white'
                                        }`}>
                                            {isPpmpAppOnly ? 2 : 3}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                                                    {isPpmpAppOnly ? '2nd Pick: OPPMO Reviewer' : '3rd Pick: OPPMO Reviewer'}
                                                </h4>
                                                {mode === 'reassign' && isOppmoApproved ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Approved
                                                    </span>
                                                ) : !canEditOppmo && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                                                        <Lock className="w-2.5 h-2.5" /> Locked
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-indigo-800">
                                                Consolidation, Annual Procurement Plan (APP) generation, and BAC scheduling.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-full">
                                        APP &amp; Consolidation
                                    </span>
                                </div>

                                <div className="space-y-1.5 pt-1">

                                    <SearchableReviewerSelect
                                        value={selectedOppmoId}
                                        onChange={(newId) => setSelectedOppmoId(newId)}
                                        options={oppmoReviewers}
                                        disabled={!canEditOppmo}
                                        placeholder="Search or choose assigned OPPMO Reviewer..."
                                        accentColor="indigo"
                                    />
                                </div>
                            </div>
                            )}

                            {mode === 'reassign' && (
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                        Reason for Reassignment (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={reassignReason}
                                        onChange={(e) => setReassignReason(e.target.value)}
                                        placeholder="e.g. Correcting reviewer assignment according to division domain..."
                                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
                        <span className="text-[11px] text-slate-500 max-w-sm leading-tight">
                            {mode === 'reassign'
                                ? 'Reassigned reviewer will receive the PPMP document first before acting for official monitoring.'
                                : 'Assigned reviewers can be updated or reassigned at any time.'}
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition shadow-2xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || loadingData}
                                className={`inline-flex items-center gap-1.5 px-5 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 ${
                                    mode === 'reassign'
                                        ? 'bg-amber-600 hover:bg-amber-700'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>{mode === 'reassign' ? 'Updating Reviewers...' : 'Submitting PPMP...'}</span>
                                    </>
                                ) : (
                                    <>
                                        {mode === 'reassign' ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                                        <span>{mode === 'reassign' ? 'Save Assigned Reviewers' : 'Confirm & Submit for Review'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
