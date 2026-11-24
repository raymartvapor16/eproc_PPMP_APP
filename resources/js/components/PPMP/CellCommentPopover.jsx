import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    MessageSquare,
    Check,
    CheckCircle2,
    CheckCircle,
    Clock,
    AlertCircle,
    Trash2,
    X,
    Send,
    User,
    Shield,
    Sparkles,
    CornerDownRight,
    Loader2,
    History,
    FileText,
    Layers,
    Edit3,
    Save,
    ChevronDown,
    Bookmark,
    BookOpen,
} from 'lucide-react';
import { formatDate } from '../UI/StatusBadge';
import { procurementModeService } from '../../services/api';
import { showConfirm } from '../../utils/modalAlert';
import { AttachmentUnitCombobox } from './AttachmentUnitCombobox';
import { MonthRangeInput } from './MonthRangeInput';
import { SupportingDocsDropdown } from './SupportingDocsDropdown';
import { AccountCodeCombobox } from './AccountCodeCombobox';
import { ProgramNameCombobox } from './ProgramNameCombobox';
import {
    BASE_DELIVERY_PERIODS,
    BASE_PLACES_OF_DELIVERY,
    BASE_PAYMENT_METHODS,
} from '../../utils/procurementOptions';

const DEFAULT_PROCUREMENT_MODES = [
    'Competitive Bidding (RA 12009)',
    'Small Value Procurement (RA 12009)',
    'Direct Contracting',
    'Repeat Order',
    'Shopping',
    'Negotiated Procurement',
    'Limited Source Bidding',
    'Direct Acquisition',
    'Scientific, Scholarly or Artistic Work, Exclusive Technology and Media Services',
];

export const MAX_COMMENT_WORDS = 1000;

const MARKET_SCOPING_PRESETS_BY_PARAM = {
    project_cost_estimate: [
        'Cost estimate aligns with current market prices based on recent supplier quotations and canvass sheets.',
        'Updated ABC / estimated budget to reflect prevailing market rates.',
        'No adjustment needed; current budgetary allocation is realistic and sufficient.',
    ],
    project_design_specification: [
        'Multiple qualified suppliers/contractors in the market can meet the proposed technical and financial requirements.',
        'Specifications refined to ensure open competition and avoid restrictive brand requirements.',
    ],
    technical_criteria: [
        'Market fully supports the proposed technical criteria and quality standards.',
        'Technical criteria aligned with readily available industry-standard specifications.',
    ],
    delivery_lead_time: [
        'Proposed delivery lead time is feasible based on supplier availability and logistics.',
        'Adjusted delivery schedule to accommodate standard supplier fulfillment lead times.',
    ],
    storage_warehousing: [
        'PGSO Warehouse / End-User storage facility can accommodate the items under required handling conditions.',
        'Staggered delivery / direct on-site delivery recommended to minimize storage constraints.',
        'Not applicable for this procurement project.',
    ],
    identified_risks: [
        'Minimal market risk identified; sufficient local and regional suppliers are available.',
        'Price volatility noted; monitor prevailing market rates and include standard price contingency clauses.',
        'Limited supplier pool; early procurement activity and wide posting on PhilGEPS recommended.',
    ],
};

export const countWords = (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
};

export const clampToMaxWords = (text, maxWords = MAX_COMMENT_WORDS) => {
    const raw = String(text ?? '');
    const tokens = raw.match(/\S+|\s+/g);
    if (!tokens) return raw;
    let wordCount = 0;
    let result = '';
    for (const token of tokens) {
        if (/\S/.test(token)) {
            if (wordCount >= maxWords) {
                break;
            }
            wordCount += 1;
        }
        result += token;
    }
    return result;
};

export const CellCommentPopover = ({
    anchorEl = null,
    itemNo,
    fieldKey,
    fieldLabel,
    cellValue,
    contextData = null,
    comments = [],
    changeLogs = [],
    canComment = false,
    canComply = false,
    currentUser,
    onAddComment,
    onDeleteComment,
    onComplyComment,
    onUncomplyComment,
    onUpdateCellValue,
    onClose,
}) => {
    const modalRef = useRef(null);
    const [newComment, setNewComment] = useState('');
    const [complianceNotes, setComplianceNotes] = useState({});
    const [activeComplyId, setActiveComplyId] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);

    const [editedValue, setEditedValue] = useState(
        cellValue !== null && cellValue !== undefined ? String(cellValue) : ''
    );
    const [editSuccess, setEditSuccess] = useState(false);
    const [procurementModes, setProcurementModes] = useState([]);

    const fk = String(fieldKey || '').toLowerCase();
    const fl = String(fieldLabel || '').toLowerCase();

    const isModeOfProcurement =
        fk === 'procurement_mode' ||
        (fk.includes('mode') && !fk.includes('payment')) ||
        fl.includes('mode of procurement');

    const isPreProcConference =
        fk === 'pre_proc_conference' ||
        fl.includes('pre-procurement conference');

    const isProgramAndAccountCode =
        (fl.includes('program name') && fl.includes('account code')) ||
        (fk === 'program_name' && fl.includes('account code')) ||
        fk === 'category' ||
        fl.includes('category / program');

    const isProgramName =
        !isProgramAndAccountCode && (
            fk === 'program_name' ||
            (fl.includes('program name') && !fl.includes('account code'))
        );

    const isAccountCode =
        !isProgramAndAccountCode && (
            fk === 'account_code' ||
            fl.includes('account code')
        );

    const isProjectType =
        fk === 'project_type' ||
        fl.includes('type of project') ||
        fl.includes('type of the project');

    const isPlanType =
        fk === 'plan_type' ||
        fl.includes('plan type');

    const isUnitField =
        (fk.includes('unit') && (fk.startsWith('att_') || fl.includes('unit'))) &&
        !fk.includes('cost') &&
        !fl.includes('implementing') &&
        !fl.includes('office');

    const isDateField =
        fk === 'start_date' ||
        fk === 'end_date' ||
        (fk === 'delivery_period' && !fk.startsWith('att_')) ||
        fl.includes('procurement activity');

    const isSupportingDocs =
        fk === 'supporting_docs_text' ||
        fk.includes('supporting_docs') ||
        fl.includes('attached supporting documents');

    const isOtherTermsAndDelivery =
        (fk === 'att_other_terms' || fk === 'att_warranty_terms' || fl.includes('other terms')) &&
        (fl.includes('delivery info') || fl.includes('delivery') || contextData?.placeOfDelivery !== undefined || contextData?.deliveryPeriod !== undefined);

    const isDeliveryPeriod =
        !isOtherTermsAndDelivery && (fk.includes('delivery_period') || fl.includes('delivery period')) && !isDateField;

    const isPlaceOfDelivery =
        !isOtherTermsAndDelivery && (fk.includes('place_of_delivery') || fl.includes('place of delivery'));

    const isPaymentMethod =
        !isOtherTermsAndDelivery && (fk.includes('payment_method') || fl.includes('payment method'));

    const isCurrencyField =
        fk.includes('budget') ||
        fk.includes('unit_cost') ||
        fk.includes('total_cost') ||
        (fk.includes('cost') && !fk.includes('center')) ||
        fl.includes('estimated budget') ||
        fl.includes('unit cost') ||
        fl.includes('total cost');

    const isQtyField =
        (fk.includes('qty') || fk === 'quantity') && fk.startsWith('att_');

    const isFiscalYear =
        fk === 'fiscal_year' ||
        fl.includes('fiscal year');

    const isMarketScopingActivityCheck =
        (fk.startsWith('ms_activity_') && !fk.endsWith('_custom_text') && !fk.endsWith('_documentation')) ||
        (fl.includes('market scoping activity') && !fl.includes('documentation') && !fk.endsWith('_custom_text'));

    const isMarketScopingResultConsidered =
        (fk.startsWith('ms_result_') && fk.endsWith('_considered')) ||
        (fl.includes('market scoping') && fl.includes('considered?'));

    const isMarketScopingResultRecommendation =
        (fk.startsWith('ms_result_') && fk.endsWith('_recommendations')) ||
        (fl.includes('market scoping') && fl.includes('(recommendations)'));

    const isMarketScopingPeriod =
        fk === 'ms_scoping_period' ||
        fl.includes('period of market scoping');

    const isMarketScopingExpectedDelivery =
        fk === 'ms_expected_delivery' ||
        (fl.includes('market scoping') && fl.includes('expected date of delivery'));

    const msParamCode = useMemo(() => {
        const m = fk.match(/^ms_result_([a-z_]+)_(considered|recommendations)$/);
        return m ? m[1] : null;
    }, [fk]);

    useEffect(() => {
        let isMounted = true;
        if (isModeOfProcurement) {
            procurementModeService
                .getAll({ active_only: 1 })
                .then((res) => {
                    if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
                        setProcurementModes(res.data);
                    }
                })
                .catch(() => {});
        }
        return () => {
            isMounted = false;
        };
    }, [isModeOfProcurement]);

    const modesList = useMemo(() => {
        if (procurementModes.length > 0) return procurementModes;
        return DEFAULT_PROCUREMENT_MODES.map((name, i) => ({ id: i, name }));
    }, [procurementModes]);

    const parseProgAndAcct = (val) => {
        const raw = String(val || '').trim();
        if (!raw) return { program: '', account: '' };
        if (raw.includes(' • ')) {
            const parts = raw.split(' • ');
            return {
                program: (parts[0] || '').trim(),
                account: parts.slice(1).join(' • ').trim(),
            };
        }
        if (/\b\d-\d{2}-\d{2}-\d{3}\b/.test(raw) || /\b\d-\d{2}-\d{2}-\d{2}-\d{3}\b/.test(raw)) {
            return { program: '', account: raw };
        }
        return { program: raw, account: '' };
    };

    const [selectedProgramName, setSelectedProgramName] = useState(() => {
        if (isProgramAndAccountCode) {
            return parseProgAndAcct(cellValue).program;
        }
        return '';
    });

    const [selectedAccountCode, setSelectedAccountCode] = useState(() => {
        if (isProgramAndAccountCode) {
            return parseProgAndAcct(cellValue).account;
        }
        return '';
    });

    const updateCombinedProgAndAcct = (newProg, newAcct) => {
        setSelectedProgramName(newProg);
        setSelectedAccountCode(newAcct);
        const p = (newProg || '').trim();
        const a = (newAcct || '').trim();
        let combined = '';
        if (p && a) {
            combined = `${p} • ${a}`;
        } else if (p) {
            combined = p;
        } else if (a) {
            combined = a;
        }
        setEditedValue(combined);
    };

    const parseTermsAndDelivery = (val, ctx) => {
        let ot = ctx?.otherTerms ?? '';
        let pod = ctx?.placeOfDelivery ?? '';
        let pm = ctx?.paymentMethod ?? '';
        let dp = ctx?.deliveryPeriod ?? '';

        if (typeof val === 'string' && val.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(val);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.other_terms || parsed.otherTerms) ot = parsed.other_terms || parsed.otherTerms;
                    if (parsed.place_of_delivery || parsed.placeOfDelivery) pod = parsed.place_of_delivery || parsed.placeOfDelivery;
                    if (parsed.payment_method || parsed.paymentMethod) pm = parsed.payment_method || parsed.paymentMethod;
                    if (parsed.delivery_period || parsed.deliveryPeriod) dp = parsed.delivery_period || parsed.deliveryPeriod;
                }
            } catch (e) {}
        } else if (typeof val === 'string' && val.trim()) {
            const podMatch = val.match(/Place of Delivery:\s*([^\n\r]+)/i);
            const pmMatch = val.match(/Payment Method:\s*([^\n\r]+)/i);
            const dpMatch = val.match(/Delivery Period:\s*([^\n\r]+)/i);

            if (podMatch) pod = podMatch[1].trim();
            if (pmMatch) pm = pmMatch[1].trim();
            if (dpMatch) dp = dpMatch[1].trim();

            if (!ot) {
                let cleaned = val
                    .replace(/Place of Delivery:\s*[^\n\r]+/ig, '')
                    .replace(/Payment Method:\s*[^\n\r]+/ig, '')
                    .replace(/Delivery Period:\s*[^\n\r]+/ig, '')
                    .replace(/^-{3,}$/mg, '')
                    .trim();
                if (cleaned && cleaned !== 'Other Terms') {
                    ot = cleaned;
                }
            }
        }

        return {
            otherTerms: ot,
            placeOfDelivery: pod || 'PGSO Warehouse/On-site',
            paymentMethod: pm || 'Staggered Delivery/Credit-basis',
            deliveryPeriod: dp || 'As Per Demand by the End-User',
        };
    };

    const [selectedOtherTerms, setSelectedOtherTerms] = useState(() => {
        if (isOtherTermsAndDelivery) {
            return parseTermsAndDelivery(cellValue, contextData).otherTerms;
        }
        return '';
    });
    const [selectedPlaceOfDelivery, setSelectedPlaceOfDelivery] = useState(() => {
        if (isOtherTermsAndDelivery) {
            return parseTermsAndDelivery(cellValue, contextData).placeOfDelivery;
        }
        return 'PGSO Warehouse/On-site';
    });
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
        if (isOtherTermsAndDelivery) {
            return parseTermsAndDelivery(cellValue, contextData).paymentMethod;
        }
        return 'Staggered Delivery/Credit-basis';
    });
    const [selectedDeliveryPeriod, setSelectedDeliveryPeriod] = useState(() => {
        if (isOtherTermsAndDelivery) {
            return parseTermsAndDelivery(cellValue, contextData).deliveryPeriod;
        }
        return 'As Per Demand by the End-User';
    });

    const updateCombinedTerms = (partial) => {
        const nextOt = partial.otherTerms !== undefined ? partial.otherTerms : selectedOtherTerms;
        const nextPod = partial.placeOfDelivery !== undefined ? partial.placeOfDelivery : selectedPlaceOfDelivery;
        const nextPm = partial.paymentMethod !== undefined ? partial.paymentMethod : selectedPaymentMethod;
        const nextDp = partial.deliveryPeriod !== undefined ? partial.deliveryPeriod : selectedDeliveryPeriod;

        if (partial.otherTerms !== undefined) setSelectedOtherTerms(nextOt);
        if (partial.placeOfDelivery !== undefined) setSelectedPlaceOfDelivery(nextPod);
        if (partial.paymentMethod !== undefined) setSelectedPaymentMethod(nextPm);
        if (partial.deliveryPeriod !== undefined) setSelectedDeliveryPeriod(nextDp);

        const payload = JSON.stringify({
            other_terms: nextOt,
            place_of_delivery: nextPod,
            payment_method: nextPm,
            delivery_period: nextDp,
        });
        setEditedValue(payload);
    };

    useEffect(() => {
        if (isProgramAndAccountCode) {
            const parsed = parseProgAndAcct(cellValue);
            setSelectedProgramName(parsed.program);
            setSelectedAccountCode(parsed.account);
            setEditedValue(cellValue !== null && cellValue !== undefined ? String(cellValue) : '');
        } else if (isOtherTermsAndDelivery) {
            const parsed = parseTermsAndDelivery(cellValue, contextData);
            setSelectedOtherTerms(parsed.otherTerms);
            setSelectedPlaceOfDelivery(parsed.placeOfDelivery);
            setSelectedPaymentMethod(parsed.paymentMethod);
            setSelectedDeliveryPeriod(parsed.deliveryPeriod);
            setEditedValue(JSON.stringify({
                other_terms: parsed.otherTerms,
                place_of_delivery: parsed.placeOfDelivery,
                payment_method: parsed.paymentMethod,
                delivery_period: parsed.deliveryPeriod,
            }));
        } else if (isPreProcConference) {
            const isYes = cellValue === true || cellValue === 'YES' || cellValue === '1';
            setEditedValue(isYes ? 'YES' : 'NO');
        } else if (isMarketScopingActivityCheck) {
            const norm = String(cellValue ?? '').trim().toUpperCase();
            const isChecked = ['CHECKED', 'YES', '1', 'TRUE', '✓'].includes(norm) || cellValue === true;
            setEditedValue(isChecked ? 'Checked' : 'Unchecked');
        } else {
            setEditedValue(cellValue !== null && cellValue !== undefined ? String(cellValue) : '');
        }
    }, [cellValue, isPreProcConference, isMarketScopingActivityCheck, isProgramAndAccountCode, isOtherTermsAndDelivery, contextData]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const commentWordCount = useMemo(() => countWords(newComment), [newComment]);
    const isOverWordLimit = commentWordCount > MAX_COMMENT_WORDS;

    const handleCommentChange = (e) => {
        const val = e.target.value;
        if (countWords(val) > MAX_COMMENT_WORDS) {
            setNewComment(clampToMaxWords(val, MAX_COMMENT_WORDS));
        } else {
            setNewComment(val);
        }
    };

    const handlePostComment = async (e) => {
        e.preventDefault();
        const trimmed = newComment.trim();
        if (!trimmed || loadingAction || countWords(trimmed) > MAX_COMMENT_WORDS) return;

        setLoadingAction(true);
        try {
            await onAddComment(clampToMaxWords(trimmed, MAX_COMMENT_WORDS));
            setNewComment('');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleComply = async (commentId, customNote = null) => {
        if (loadingAction) return;
        setLoadingAction(true);
        try {
            const rawNote = customNote !== null ? customNote : (complianceNotes[commentId] || '');
            const note = clampToMaxWords(rawNote, MAX_COMMENT_WORDS);
            await onComplyComment(commentId, note);
            setActiveComplyId(null);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleUncomply = async (commentId) => {
        if (loadingAction) return;
        setLoadingAction(true);
        try {
            await onUncomplyComment(commentId);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDelete = async (commentId) => {
        if (loadingAction) return;
        const confirmed = await showConfirm({
            title: 'Delete Review Comment',
            message: 'Are you sure you want to delete this review comment?',
            confirmText: 'Yes, Delete Comment',
            cancelText: 'Cancel',
            type: 'danger',
        });
        if (!confirmed) return;
        setLoadingAction(true);
        try {
            await onDeleteComment(commentId);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleApplyEdit = async (markComplied = false) => {
        if (loadingAction) return;

        let finalVal = editedValue;
        if (isPreProcConference) {
            finalVal = (editedValue === 'YES' || editedValue === true || editedValue === '1') ? 'YES' : 'NO';
        } else if (isMarketScopingActivityCheck) {
            const norm = String(editedValue ?? '').trim().toUpperCase();
            finalVal = (['CHECKED', 'YES', '1', 'TRUE', '✓'].includes(norm) || editedValue === true) ? 'Checked' : 'Unchecked';
        }

        setLoadingAction(true);
        try {
            let cellAlreadyUpdated = false;
            if (onUpdateCellValue) {
                try {
                    await onUpdateCellValue(finalVal);
                    cellAlreadyUpdated = true;
                    setEditSuccess(true);
                    setTimeout(() => setEditSuccess(false), 2500);
                } catch (err) {
                    console.error('Failed to update cell value:', err);
                    return;
                }
            }

            if (markComplied && pendingComments.length > 0 && onComplyComment) {
                for (const c of pendingComments) {
                    await onComplyComment(
                        c.id,
                        `Complied and updated cell value to: "${finalVal}"`,
                        cellAlreadyUpdated ? null : finalVal
                    );
                }
            }
        } finally {
            setLoadingAction(false);
        }
    };

    const pendingComments = comments.filter((c) => c.status === 'pending');
    const compliedComments = comments.filter((c) => c.status === 'complied');

    const matchingChangeLogs = React.useMemo(() => {
        if (!Array.isArray(changeLogs) || changeLogs.length === 0) return [];
        return changeLogs.filter((log) => {
            if (!log || !log.field_name) return false;
            const fn = String(log.field_name).toLowerCase().trim();
            const fl = String(fieldLabel || '').toLowerCase().trim();
            const fk = String(fieldKey || '').toLowerCase().trim();
            const actionStr = String(log.action || '').toLowerCase().trim();

            if (!itemNo && !fk.startsWith('att_r') && (fn === fl || fn === fk)) {
                return true;
            }

            if (!fk.startsWith('att_') && itemNo !== null && itemNo !== undefined) {
                const itemPrefix = `item #${itemNo}`;
                const itemPrefixAlt = `item ${itemNo}`;
                const hasItemPrefix =
                    fn.includes(itemPrefix) ||
                    fn.includes(itemPrefixAlt) ||
                    actionStr.includes(itemPrefix) ||
                    actionStr.includes(itemPrefixAlt);

                if (!hasItemPrefix) return false;

                if (fk === 'description' || fk.includes('desc')) {
                    return (fn.includes('description') || fn.includes('desc') || fn === 'description') && !fn.includes('attachment') && !fn.includes('row #');
                }
                if (fk === 'estimated_budget' || fk.includes('budget') || fl.includes('budget') || fl.includes('allocation')) {
                    return (fn.includes('estimated budget') || fn.includes('budget') || fn.includes('allocation') || fn === 'estimated_budget') && !fn.includes('total budget');
                }
                if (fk === 'procurement_mode' || fk.includes('mode') || fl.includes('mode')) {
                    return fn.includes('procurement mode') || fn.includes('mode of procurement') || fn === 'procurement_mode' || fn === 'mode';
                }
                if (fk === 'quantity_size' || fk.includes('quant') || fk.includes('size') || fl.includes('quantity')) {
                    return fn.includes('quantity') || fn.includes('size') || fn.includes('qty') || fn === 'quantity_size';
                }
                if (fk === 'project_type' || fl.includes('project type')) {
                    return fn.includes('project_type') || fn.includes('project type') || fn.includes('type of project');
                }
                if (fk === 'pre_proc_conference' || fl.includes('pre-proc')) {
                    return fn.includes('pre_proc') || fn.includes('pre-proc') || fn.includes('conference');
                }
                if (fk === 'start_date' || fl.includes('start activity')) {
                    return fn.includes('start_date') || fn.includes('start activity') || fn.includes('start date');
                }
                if (fk === 'end_date' || fl.includes('end activity')) {
                    return fn.includes('end_date') || fn.includes('end activity') || fn.includes('end date');
                }
                if (fk === 'delivery_period' || fl.includes('expected delivery')) {
                    return fn.includes('delivery period') || fn.includes('delivery_period');
                }
                if (fk === 'source_of_fund' || fl.includes('source of fund')) {
                    return fn.includes('source of fund') || fn.includes('source_of_fund') || fn.includes('fund source');
                }
                if (fk === 'supporting_docs_text' || fl.includes('supporting')) {
                    return fn.includes('supporting') || fn.includes('docs');
                }
                if (fk === 'remarks' || fl.includes('remark')) {
                    return fn.includes('remarks') || fn.includes('notes');
                }

                return false;
            }

            const attRowMatch = fk.match(/^att_r(\d+)_(.+)$/);
            if (attRowMatch) {
                const rowNum = attRowMatch[1];
                const subField = attRowMatch[2].toLowerCase();
                const rowPrefix = `row #${rowNum}`;
                const rowPrefixAlt = `row ${rowNum}`;

                if (itemNo !== null && itemNo !== undefined) {
                    const specItemMatch = fn.match(/(?:detailed specifications|attachment list)\s*#(\d+)/);
                    if (specItemMatch && Number(specItemMatch[1]) !== Number(itemNo)) {
                        return false;
                    }
                }

                if (fn.includes(rowPrefix) || fn.includes(rowPrefixAlt)) {
                    if (subField.includes('desc')) {
                        return fn.includes('description') || fn.includes('desc');
                    }
                    if (subField.includes('unit') && !subField.includes('cost')) {
                        return fn.includes('unit') && !fn.includes('cost');
                    }
                    if (subField.includes('qty')) {
                        return fn.includes('quantity') || fn.includes('qty');
                    }
                    if (subField.includes('unitcost') || (subField.includes('cost') && !subField.includes('total'))) {
                        return fn.includes('unit cost');
                    }
                    if (subField.includes('totalcost') || (subField.includes('cost') && subField.includes('total'))) {
                        return fn.includes('total cost');
                    }
                    if (subField.includes('item_no')) {
                        return fn.includes('item no') || fn.includes('item_no');
                    }
                }
                return false;
            }

            if (fk.startsWith('att_')) {
                if (fk.includes('terms') || fk.includes('other')) {
                    return fn.includes('terms') || fn.includes('other terms') || fn.includes('warranty');
                }
                if (fk.includes('delivery_period')) {
                    return (fn.includes('delivery period') || fn.includes('delivery_period')) && (fn.includes('attachment') || fn.includes('detailed'));
                }
                if (fk.includes('place_of_delivery')) {
                    return fn.includes('place of delivery') || fn.includes('place_of_delivery');
                }
                if (fk.includes('payment')) {
                    return fn.includes('payment method') || fn.includes('payment_method');
                }
                if (fk.includes('charges')) {
                    return fn.includes('charges');
                }
                if (fk.includes('title') || fk.includes('project_title')) {
                    return (fn.includes('attachment') || fn.includes('detailed')) && (fn.includes('project title') || fn.includes('title'));
                }
                if (fk.includes('office') || fk.includes('unit')) {
                    return (fn.includes('attachment') || fn.includes('detailed')) && (fn.includes('office') || fn.includes('unit') || fn.includes('implementing'));
                }
                if (fk.includes('fiscal_year')) {
                    return (fn.includes('attachment') || fn.includes('detailed')) && fn.includes('fiscal');
                }
                if (fk.includes('budget')) {
                    return (fn.includes('attachment') || fn.includes('detailed')) && fn.includes('budget');
                }
                return false;
            }

            if (fk === 'program_name' || fk === 'account_code') {
                return (
                    (fn.includes('program name') || fn.includes('program_name') || fn.includes('account code') || fn.includes('account_code') || fn.includes('category')) &&
                    !fn.includes('item #') && !fn.includes('row #')
                );
            }

            if (fk === 'implementing_unit') {
                return (
                    (fn.includes('implementing unit') || fn.includes('implementing_unit') || fn.includes('end-user')) &&
                    !fn.includes('item #') && !fn.includes('row #') && !fn.includes('detailed') && !fn.includes('attachment')
                );
            }

            if (fk === 'total_budget') {
                return (fn.includes('total budget') || fn === 'total_budget') && !fn.includes('item #') && !fn.includes('row #');
            }
            if (fk === 'ppmp_number') {
                return (fn.includes('ppmp number') || fn.includes('ppmp no') || fn.includes('ppmp_number')) && !fn.includes('item #');
            }
            if (fk === 'fiscal_year') {
                return (fn.includes('fiscal year') || fn.includes('fiscal_year')) && !fn.includes('item #') && !fn.includes('detailed') && !fn.includes('attachment');
            }
            if (fk === 'title') {
                return (fn.includes('project title') || fn === 'title') && !fn.includes('item #') && !fn.includes('detailed') && !fn.includes('attachment');
            }
            if (fk === 'plan_type') {
                return fn.includes('plan type') || fn.includes('plan_type');
            }
            if (fk === 'delivery_period') {
                return (fn.includes('delivery period') || fn === 'delivery_period') && !fn.includes('item #') && !fn.includes('row #') && !fn.includes('detailed') && !fn.includes('attachment');
            }
            if (fk === 'place_of_delivery') {
                return (fn.includes('place of delivery') || fn === 'place_of_delivery') && !fn.includes('row #') && !fn.includes('detailed') && !fn.includes('attachment');
            }
            if (fk === 'payment_method') {
                return (fn.includes('payment method') || fn === 'payment_method') && !fn.includes('row #') && !fn.includes('detailed') && !fn.includes('attachment');
            }
            if (fk === 'source_of_fund') {
                return (fn.includes('source of fund') || fn === 'source_of_fund') && !fn.includes('item #') && !fn.includes('row #');
            }

            return false;
        });
    }, [changeLogs, fieldKey, fieldLabel, itemNo]);

    const commentWithOldValue = comments.find(
        (c) => c.cell_value && String(c.cell_value).trim() !== ''
    );
    const commentRecordedValue = commentWithOldValue ? String(commentWithOldValue.cell_value).trim() : null;

    const latestChangeLog = matchingChangeLogs.length > 0 ? matchingChangeLogs[matchingChangeLogs.length - 1] : null;
    const changeLogOldValue =
        latestChangeLog &&
        latestChangeLog.old_value &&
        latestChangeLog.old_value !== '(empty)' &&
        latestChangeLog.old_value !== '(none)'
            ? String(latestChangeLog.old_value).trim()
            : null;

    const resolvedOldValue = commentRecordedValue || changeLogOldValue;
    const currentValStr = cellValue !== undefined && cellValue !== null ? String(cellValue).trim() : '';

    const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const hasDifferentValue = Boolean(
        resolvedOldValue && currentValStr && normalize(resolvedOldValue) !== normalize(currentValStr)
    );
    const isComplied = comments.some((c) => c.status === 'complied');
    const showOldAndNewData = Boolean(
        resolvedOldValue && (
            hasDifferentValue ||
            (isComplied && commentRecordedValue) ||
            matchingChangeLogs.some((l) => normalize(l.old_value) !== normalize(l.new_value))
        )
    );

    const renderDynamicCellInput = () => {

        if (isProgramAndAccountCode) {
            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-3 shadow-xs">

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                                <span>Program Name</span>
                            </label>
                            {selectedProgramName && (
                                <button
                                    type="button"
                                    onClick={() => updateCombinedProgAndAcct('', selectedAccountCode)}
                                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                                >
                                    ✕ Remove Program Name
                                </button>
                            )}
                        </div>
                        <ProgramNameCombobox
                            value={selectedProgramName}
                            onChange={(newProg) => updateCombinedProgAndAcct(newProg, selectedAccountCode)}
                            placeholder="Search or Select Program Name..."
                        />
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Account Code &amp; Title</span>
                            </label>
                            {selectedAccountCode && (
                                <button
                                    type="button"
                                    onClick={() => updateCombinedProgAndAcct(selectedProgramName, '')}
                                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                                >
                                    ✕ Clear Account Code
                                </button>
                            )}
                        </div>
                        <AccountCodeCombobox
                            value={selectedAccountCode}
                            onChange={(newAcct) => updateCombinedProgAndAcct(selectedProgramName, newAcct)}
                            placeholder="Search Account Code (e.g. 5-02-03-220 or Office Supplies)..."
                        />
                    </div>

                    <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                        <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">
                            Formatted Cell Result:
                        </span>
                        <div className="font-mono text-xs font-bold text-slate-900 break-words">
                            {selectedProgramName && (
                                <span className="text-blue-900 underline block mb-0.5">{selectedProgramName}</span>
                            )}
                            <span>{selectedAccountCode || <span className="text-slate-400 italic font-sans font-normal">No account code chosen</span>}</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (isProgramName) {
            return (
                <div className="bg-white p-2 border border-blue-300 rounded-xl shadow-2xs">
                    <ProgramNameCombobox
                        value={editedValue}
                        onChange={(newVal) => setEditedValue(newVal)}
                        placeholder="Search Program Name..."
                    />
                </div>
            );
        }

        if (isAccountCode) {
            return (
                <div className="bg-white p-2 border border-blue-300 rounded-xl shadow-2xs">
                    <AccountCodeCombobox
                        value={editedValue}
                        onChange={(newVal) => setEditedValue(newVal)}
                        placeholder="Search Account Code (e.g. 5-02-03-220 or Office Supplies)..."
                    />
                </div>
            );
        }

        if (isOtherTermsAndDelivery) {
            const hasStandardPlace = BASE_PLACES_OF_DELIVERY.includes(selectedPlaceOfDelivery);
            const hasStandardPayment = BASE_PAYMENT_METHODS.includes(selectedPaymentMethod);
            const hasStandardDelivery = BASE_DELIVERY_PERIODS.includes(selectedDeliveryPeriod);

            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-3.5 shadow-xs text-left">

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Other Terms / Green Specs / Specific Conditions</span>
                        </label>
                        <textarea
                            rows={3}
                            value={selectedOtherTerms}
                            onChange={(e) => updateCombinedTerms({ otherTerms: e.target.value })}
                            placeholder="Type Green Specs, warranty terms, or specific procurement terms..."
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed resize-y font-normal"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                                Place of Delivery
                            </label>
                            <div className="relative">
                                <select
                                    value={hasStandardPlace ? selectedPlaceOfDelivery : (selectedPlaceOfDelivery ? 'CUSTOM' : '')}
                                    onChange={(e) => {
                                        if (e.target.value !== 'CUSTOM') {
                                            updateCombinedTerms({ placeOfDelivery: e.target.value });
                                        }
                                    }}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none pr-8 cursor-pointer"
                                >
                                    <option value="">-- Choose Place of Delivery --</option>
                                    {BASE_PLACES_OF_DELIVERY.map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                    <option value="CUSTOM">-- Custom Place of Delivery --</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            {(!hasStandardPlace || selectedPlaceOfDelivery === 'CUSTOM') && (
                                <input
                                    type="text"
                                    value={selectedPlaceOfDelivery === 'CUSTOM' ? '' : selectedPlaceOfDelivery}
                                    onChange={(e) => updateCombinedTerms({ placeOfDelivery: e.target.value })}
                                    placeholder="Enter custom place of delivery..."
                                    className="w-full text-xs p-2 border border-blue-300 rounded-lg bg-blue-50/30 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                                Payment Method
                            </label>
                            <div className="relative">
                                <select
                                    value={hasStandardPayment ? selectedPaymentMethod : (selectedPaymentMethod ? 'CUSTOM' : '')}
                                    onChange={(e) => {
                                        if (e.target.value !== 'CUSTOM') {
                                            updateCombinedTerms({ paymentMethod: e.target.value });
                                        }
                                    }}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none pr-8 cursor-pointer"
                                >
                                    <option value="">-- Choose Payment Method --</option>
                                    {BASE_PAYMENT_METHODS.map((opt, idx) => (
                                        <option key={idx} value={opt}>
                                            {opt.length > 40 ? `${opt.slice(0, 40)}...` : opt}
                                        </option>
                                    ))}
                                    <option value="CUSTOM">-- Custom Payment Method --</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            {(!hasStandardPayment || selectedPaymentMethod === 'CUSTOM') && (
                                <input
                                    type="text"
                                    value={selectedPaymentMethod === 'CUSTOM' ? '' : selectedPaymentMethod}
                                    onChange={(e) => updateCombinedTerms({ paymentMethod: e.target.value })}
                                    placeholder="Enter custom payment method..."
                                    className="w-full text-xs p-2 border border-blue-300 rounded-lg bg-blue-50/30 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-100">
                        <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                            Delivery Period
                        </label>
                        <div className="relative">
                            <select
                                value={hasStandardDelivery ? selectedDeliveryPeriod : (selectedDeliveryPeriod ? 'CUSTOM' : '')}
                                onChange={(e) => {
                                    if (e.target.value !== 'CUSTOM') {
                                        updateCombinedTerms({ deliveryPeriod: e.target.value });
                                    }
                                }}
                                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none pr-8 cursor-pointer"
                            >
                                <option value="">-- Choose Delivery Period --</option>
                                {BASE_DELIVERY_PERIODS.map((opt, idx) => (
                                    <option key={idx} value={opt}>
                                        {opt.replace(/\n/g, ' ')}
                                    </option>
                                ))}
                                <option value="CUSTOM">-- Custom Delivery Period --</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {(!hasStandardDelivery || selectedDeliveryPeriod === 'CUSTOM') && (
                            <textarea
                                rows={2}
                                value={selectedDeliveryPeriod === 'CUSTOM' ? '' : selectedDeliveryPeriod}
                                onChange={(e) => updateCombinedTerms({ deliveryPeriod: e.target.value })}
                                placeholder="Enter custom delivery period..."
                                className="w-full text-xs p-2 border border-blue-300 rounded-lg bg-blue-50/30 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        )}
                    </div>

                    <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                        <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">
                            Formatted Cell Result Preview:
                        </span>
                        <div className="space-y-1 text-xs">
                            {selectedOtherTerms && (
                                <div className="font-sans whitespace-pre-wrap pb-1 border-b border-dashed border-slate-300 text-slate-800">
                                    {selectedOtherTerms}
                                </div>
                            )}
                            <div>
                                <strong className="text-slate-800">Place of Delivery:</strong>{' '}
                                <span className="text-slate-700">{selectedPlaceOfDelivery || '(None)'}</span>
                            </div>
                            <div>
                                <strong className="text-slate-800">Payment Method:</strong>{' '}
                                <span className="text-slate-700">{selectedPaymentMethod || '(None)'}</span>
                            </div>
                            <div>
                                <strong className="text-slate-800">Delivery Period:</strong>{' '}
                                <span className="text-slate-700">{selectedDeliveryPeriod || '(None)'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (isModeOfProcurement) {
            const hasCurrent = modesList.some((m) => m.name === editedValue);
            return (
                <div className="relative">
                    <select
                        value={editedValue || (modesList[0]?.name || 'Competitive Bidding (RA 12009)')}
                        onChange={(e) => setEditedValue(e.target.value)}
                        className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                    >
                        {editedValue && !hasCurrent && (
                            <option value={editedValue}>
                                {editedValue} (Current / Inactive)
                            </option>
                        )}
                        {modesList.map((m) => (
                            <option key={m.id || m.name} value={m.name}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            );
        }

        if (isPreProcConference) {
            const isYes = editedValue === 'YES' || editedValue === true || editedValue === '1';
            return (
                <div className="bg-white p-3.5 border border-blue-300 rounded-xl space-y-3 shadow-2xs">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isYes}
                            onChange={(e) => setEditedValue(e.target.checked ? 'YES' : 'NO')}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                            Pre-Procurement Conference, if applicable
                        </span>
                    </label>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Selected:</span>
                        <button
                            type="button"
                            onClick={() => setEditedValue('YES')}
                            className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                                isYes
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs ring-1 ring-amber-400'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            YES
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditedValue('NO')}
                            className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                                !isYes
                                    ? 'bg-slate-200 text-slate-800 border border-slate-400 shadow-xs ring-1 ring-slate-400'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            NO
                        </button>
                    </div>
                </div>
            );
        }

        if (isProjectType) {
            return (
                <div className="relative">
                    <select
                        value={editedValue || 'Goods'}
                        onChange={(e) => setEditedValue(e.target.value)}
                        className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                    >
                        <option value="Goods">Goods</option>
                        <option value="Infrastructure Projects">Infrastructure Projects</option>
                        <option value="Consulting Services">Consulting Services</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            );
        }

        if (isPlanType) {
            const isFinal = String(editedValue).toUpperCase() === 'FINAL';
            return (
                <div className="grid grid-cols-2 gap-3 bg-white p-3 border border-blue-300 rounded-xl shadow-2xs">
                    <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${
                        !isFinal
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-400'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                        <input
                            type="radio"
                            name="modal_plan_type"
                            value="INDICATIVE"
                            checked={!isFinal}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold">INDICATIVE</span>
                    </label>
                    <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition select-none ${
                        isFinal
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-400'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                        <input
                            type="radio"
                            name="modal_plan_type"
                            value="FINAL"
                            checked={isFinal}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold">FINAL</span>
                    </label>
                </div>
            );
        }

        if (isUnitField) {
            return (
                <div className="bg-white p-2.5 border border-blue-300 rounded-xl shadow-2xs">
                    <AttachmentUnitCombobox
                        value={editedValue || ''}
                        onChange={(newUnit) => setEditedValue(newUnit)}
                        placeholder="e.g. roll, pcs, unit, set..."
                    />
                </div>
            );
        }

        if (isDateField) {
            return (
                <div className="bg-white p-3.5 border border-blue-300 rounded-xl shadow-2xs flex flex-col items-center">
                    <MonthRangeInput
                        value={editedValue || ''}
                        onChange={(newDate) => setEditedValue(newDate)}
                        className="w-full"
                    />
                </div>
            );
        }

        if (isSupportingDocs) {
            return (
                <div className="bg-white p-2.5 border border-blue-300 rounded-xl shadow-2xs">
                    <SupportingDocsDropdown
                        value={editedValue || ''}
                        onChange={(val) => setEditedValue(val)}
                        placeholder="Select supporting documents..."
                    />
                </div>
            );
        }

        if (isDeliveryPeriod) {
            return (
                <div className="space-y-2">
                    <div className="relative">
                        <select
                            value={BASE_DELIVERY_PERIODS.includes(editedValue) ? editedValue : (editedValue ? 'CUSTOM' : '')}
                            onChange={(e) => {
                                if (e.target.value !== 'CUSTOM') {
                                    setEditedValue(e.target.value);
                                }
                            }}
                            className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                        >
                            <option value="">-- Choose Standard Delivery Period --</option>
                            {BASE_DELIVERY_PERIODS.map((opt, idx) => (
                                <option key={idx} value={opt}>
                                    {opt.replace(/\n/g, ' ')}
                                </option>
                            ))}
                            <option value="CUSTOM">-- Custom Delivery Period --</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <textarea
                        rows={2}
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="Or type custom delivery period..."
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            );
        }

        if (isPlaceOfDelivery) {
            return (
                <div className="space-y-2">
                    <div className="relative">
                        <select
                            value={BASE_PLACES_OF_DELIVERY.includes(editedValue) ? editedValue : (editedValue ? 'CUSTOM' : '')}
                            onChange={(e) => {
                                if (e.target.value !== 'CUSTOM') {
                                    setEditedValue(e.target.value);
                                }
                            }}
                            className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                        >
                            <option value="">-- Choose Place of Delivery --</option>
                            {BASE_PLACES_OF_DELIVERY.map((opt, idx) => (
                                <option key={idx} value={opt}>
                                    {opt}
                                </option>
                            ))}
                            <option value="CUSTOM">-- Custom Place of Delivery --</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <input
                        type="text"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="Or type custom place of delivery..."
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            );
        }

        if (isPaymentMethod) {
            return (
                <div className="space-y-2">
                    <div className="relative">
                        <select
                            value={BASE_PAYMENT_METHODS.includes(editedValue) ? editedValue : (editedValue ? 'CUSTOM' : '')}
                            onChange={(e) => {
                                if (e.target.value !== 'CUSTOM') {
                                    setEditedValue(e.target.value);
                                }
                            }}
                            className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                        >
                            <option value="">-- Choose Payment Method --</option>
                            {BASE_PAYMENT_METHODS.map((opt, idx) => (
                                <option key={idx} value={opt}>
                                    {opt.length > 60 ? `${opt.slice(0, 60)}...` : opt}
                                </option>
                            ))}
                            <option value="CUSTOM">-- Custom Payment Method --</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <textarea
                        rows={2}
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="Or type custom payment method..."
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            );
        }

        if (isCurrencyField) {
            return (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600 font-bold text-sm">
                        ₱
                    </div>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-xs sm:text-sm p-3 pl-8 border border-blue-300 rounded-xl bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                    />
                </div>
            );
        }

        if (isQtyField) {
            return (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                        #
                    </div>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="Quantity..."
                        className="w-full text-xs sm:text-sm p-3 pl-8 border border-blue-300 rounded-xl bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                    />
                </div>
            );
        }

        if (isFiscalYear) {
            return (
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-xs uppercase">
                        CY
                    </div>
                    <input
                        type="number"
                        min="2000"
                        max="2099"
                        value={String(editedValue).replace(/\D/g, '')}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder={new Date().getFullYear().toString()}
                        className="w-full text-xs sm:text-sm p-3 pl-11 border border-blue-300 rounded-xl bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                    />
                </div>
            );
        }

        if (isMarketScopingActivityCheck) {
            const norm = String(editedValue ?? '').trim().toUpperCase();
            const isChecked = ['CHECKED', 'YES', '1', 'TRUE', '✓'].includes(norm) || editedValue === true;
            const activityTitle = String(fieldLabel || fieldKey || '').replace(/^Market Scoping Activity\s*•\s*/i, '');
            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-3 shadow-xs">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setEditedValue(e.target.checked ? 'Checked' : 'Unchecked')}
                            className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                        />
                        <div className="space-y-0.5">
                            <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-snug">
                                {activityTitle || 'Conducted this Market Scoping Activity'}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                                Toggle whether this market scoping activity was conducted (Check ✓).
                            </span>
                        </div>
                    </label>
                    <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Status:</span>
                        <button
                            type="button"
                            onClick={() => setEditedValue('Checked')}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                                isChecked
                                    ? 'bg-emerald-600 text-white border border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <span>✓</span>
                            <span>Checked (Conducted)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditedValue('Unchecked')}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                                !isChecked
                                    ? 'bg-slate-800 text-white border border-slate-900 shadow-xs ring-2 ring-slate-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            <span>☐</span>
                            <span>Unchecked (Not Conducted)</span>
                        </button>
                    </div>
                </div>
            );
        }

        if (isMarketScopingResultConsidered) {
            const currentConsidered = ['Yes', 'No', 'Not Applicable'].find(
                (opt) => opt.toLowerCase() === String(editedValue || '').trim().toLowerCase()
            ) || '';
            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-3 shadow-xs">
                    <div className="relative">
                        <select
                            value={currentConsidered}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer appearance-none pr-10"
                        >
                            <option value="">-- Select Considered Status (Yes / No / Not Applicable) --</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Not Applicable">Not Applicable</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Quick Pick:</span>
                        {['Yes', 'No', 'Not Applicable'].map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => setEditedValue(opt)}
                                className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                                    currentConsidered === opt
                                        ? 'bg-blue-600 text-white border border-blue-700 shadow-xs ring-2 ring-blue-300'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        if (isMarketScopingResultRecommendation) {
            const presets = (msParamCode && MARKET_SCOPING_PRESETS_BY_PARAM[msParamCode]) || [];
            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-2.5 shadow-xs">
                    {presets.length > 0 && (
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                Quick-Select Standard Recommendation (Optional):
                            </label>
                            <div className="relative">
                                <select
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) setEditedValue(e.target.value);
                                    }}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none pr-8"
                                >
                                    <option value="">-- Choose a standard recommendation template --</option>
                                    {presets.map((preset, idx) => (
                                        <option key={idx} value={preset}>
                                            {preset}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    )}
                    <textarea
                        rows={3}
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        placeholder="Enter recommendation based on market scoping..."
                        className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs leading-relaxed resize-y"
                    />
                </div>
            );
        }

        if (isMarketScopingPeriod || isMarketScopingExpectedDelivery) {
            const parseToMonthInput = (mmYyyy) => {
                const s = String(mmYyyy || '').trim();
                if (/^\d{4}-\d{2}$/.test(s)) return s;
                const m = s.match(/^(\d{2})\/(\d{4})$/);
                return m ? `${m[2]}-${m[1]}` : '';
            };
            const formatFromMonthInput = (yyyyMm) => {
                const s = String(yyyyMm || '').trim();
                const m = s.match(/^(\d{4})-(\d{2})$/);
                return m ? `${m[2]}/${m[1]}` : s;
            };

            if (isMarketScopingPeriod) {
                const raw = String(editedValue || '').trim();
                const m = raw.match(/from\s+([^\s]+)\s+to\s+([^\s]+)/i);
                const parts = m ? [m[1], m[2]] : raw.split(/\s+(?:to|-)\s+/i);
                const curFrom = (parts[0] || '').replace(/^from\s+/i, '').replace(/_/g, '').trim();
                const curTo = (parts[1] || curFrom || '').replace(/_/g, '').trim();

                const updatePeriod = (nextFrom, nextTo) => {
                    const f = nextFrom || '____';
                    const t = nextTo || nextFrom || '____';
                    setEditedValue(`From ${f} To ${t}`);
                };

                return (
                    <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-3 shadow-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    From (mm/yyyy):
                                </label>
                                <input
                                    type="month"
                                    value={parseToMonthInput(curFrom)}
                                    onChange={(e) => updatePeriod(formatFromMonthInput(e.target.value), curTo)}
                                    className="w-full text-xs p-2.5 border border-blue-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    To (mm/yyyy):
                                </label>
                                <input
                                    type="month"
                                    value={parseToMonthInput(curTo)}
                                    onChange={(e) => updatePeriod(curFrom, formatFromMonthInput(e.target.value))}
                                    className="w-full text-xs p-2.5 border border-blue-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-bold">
                            Formatted Period: <span className="text-blue-900">{editedValue || '—'}</span>
                        </div>
                    </div>
                );
            }

            return (
                <div className="bg-white p-3.5 border-2 border-blue-200 rounded-xl space-y-2.5 shadow-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Pick Month &amp; Year:
                            </label>
                            <input
                                type="month"
                                value={parseToMonthInput(editedValue)}
                                onChange={(e) => setEditedValue(formatFromMonthInput(e.target.value))}
                                className="w-full text-xs p-2.5 border border-blue-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Or Type Delivery Schedule (mm/yyyy):
                            </label>
                            <input
                                type="text"
                                value={editedValue}
                                onChange={(e) => setEditedValue(e.target.value)}
                                placeholder="e.g. 11/2026 or 11/2026 - 12/2026"
                                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <textarea
                rows={String(editedValue || '').includes('\n') || (editedValue && editedValue.length > 50) ? 3 : 2}
                value={editedValue}
                onChange={(e) => setEditedValue(e.target.value)}
                placeholder="Enter corrected value here..."
                className="w-full text-xs sm:text-sm p-3 border border-blue-300 rounded-xl bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs leading-relaxed resize-y"
            />
        );
    };

    const formatCellValDisplay = (val) => {
        if (!val) return <span className="text-slate-400 italic font-sans font-normal">(Empty)</span>;
        if (typeof val === 'string' && val.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(val);
                if (typeof parsed === 'object' && parsed !== null) {
                    return (
                        <div className="space-y-1 text-xs font-sans text-left">
                            {(parsed.other_terms || parsed.otherTerms) && (
                                <div className="whitespace-pre-wrap pb-1 border-b border-dashed border-slate-200">
                                    <strong className="text-slate-700">Other Terms / Green Specs:</strong> {parsed.other_terms || parsed.otherTerms}
                                </div>
                            )}
                            {(parsed.place_of_delivery || parsed.placeOfDelivery) && (
                                <div><strong className="text-slate-700">Place of Delivery:</strong> {parsed.place_of_delivery || parsed.placeOfDelivery}</div>
                            )}
                            {(parsed.payment_method || parsed.paymentMethod) && (
                                <div><strong className="text-slate-700">Payment Method:</strong> {parsed.payment_method || parsed.paymentMethod}</div>
                            )}
                            {(parsed.delivery_period || parsed.deliveryPeriod) && (
                                <div><strong className="text-slate-700">Delivery Period:</strong> {parsed.delivery_period || parsed.deliveryPeriod}</div>
                            )}
                        </div>
                    );
                }
            } catch (e) {}
        }
        return <span>{val}</span>;
    };

    const modalContent = (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99998] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
            onClick={onClose}
        >

            <div
                ref={modalRef}
                className="relative w-full max-w-2xl lg:max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-300 z-[99999] my-auto flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150 text-left"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`p-2 rounded-xl text-white font-bold shrink-0 shadow-xs ${
                                pendingComments.length > 0
                                    ? 'bg-red-600 ring-2 ring-red-400/30'
                                    : 'bg-emerald-600 ring-2 ring-emerald-400/30'
                            }`}
                        >
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm uppercase font-extrabold text-red-400 tracking-wide break-words leading-tight">
                                {itemNo ? `Item #${itemNo}` : 'PPMP Field'} • {fieldLabel || fieldKey}
                            </div>
                            <div className="text-xs text-slate-300 font-semibold mt-1 flex items-center flex-wrap gap-2">
                                <span>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
                                {pendingComments.length > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/50 uppercase tracking-wide">
                                        {pendingComments.length} action required
                                    </span>
                                ) : (
                                    comments.length > 0 && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-500/50 uppercase tracking-wide">
                                            All Complied ✓
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                        title="Close modal"
                    >
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">

                    {(() => {
                        if (!resolvedOldValue && !currentValStr) return null;

                        if (showOldAndNewData) {
                            return (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-slate-800 uppercase text-xs tracking-wide flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-blue-600" />
                                            Target Cell Record History
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                            Record Purposes
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                        <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3 flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-extrabold text-amber-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                                                    <History className="w-3.5 h-3.5 text-amber-700" />
                                                    Old Data (Target)
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                                    Previous Value
                                                </span>
                                            </div>
                                            <div className="font-mono text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-amber-200 whitespace-pre-wrap break-words leading-relaxed font-medium shadow-2xs">
                                                {formatCellValDisplay(resolvedOldValue)}
                                            </div>
                                        </div>

                                        <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-extrabold text-emerald-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                                                    Updated Data
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-300">
                                                    {isComplied ? 'Complied ✓' : 'Current Value'}
                                                </span>
                                            </div>
                                            <div className="font-mono text-xs font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-emerald-200 whitespace-pre-wrap break-words leading-relaxed shadow-2xs">
                                                {formatCellValDisplay(currentValStr)}
                                            </div>
                                        </div>
                                    </div>

                                    {matchingChangeLogs.length > 0 && (
                                        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                                                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                                    Audit Trail (ppmp_change_logs)
                                                </span>
                                                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-mono">
                                                    {matchingChangeLogs.length} logged edit{matchingChangeLogs.length === 1 ? '' : 's'}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5 divide-y divide-slate-100">
                                                {matchingChangeLogs.slice(-4).reverse().map((log) => (
                                                    <div key={log.id} className="pt-1.5 first:pt-0 text-[11px] text-slate-600 flex flex-col">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <span className="font-semibold text-slate-800">
                                                                {log.field_name}
                                                            </span>
                                                            <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                                                                {formatDate(log.created_at)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] flex items-center gap-1.5 text-slate-600 font-mono mt-0.5 flex-wrap">
                                                            <span className="text-amber-800 line-through truncate max-w-[200px]" title={log.old_value}>
                                                                {log.old_value}
                                                            </span>
                                                            <span className="text-slate-400">&rarr;</span>
                                                            <span className="text-emerald-800 font-bold truncate max-w-[200px]" title={log.new_value}>
                                                                {log.new_value}
                                                            </span>
                                                            <span className="text-slate-500 text-[10px] ml-auto font-sans">
                                                                by {log.user?.name || log.role || 'User'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shrink-0">
                                <div>
                                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wide block mb-1">
                                        Target Cell Value:
                                    </span>
                                    <div className="font-bold text-slate-900 font-mono whitespace-pre-wrap break-words leading-relaxed text-xs bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                                        {formatCellValDisplay(currentValStr)}
                                    </div>
                                </div>

                                {matchingChangeLogs.length > 0 && (
                                    <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                                            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                                Audit Trail (ppmp_change_logs)
                                            </span>
                                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-mono">
                                                {matchingChangeLogs.length} logged edit{matchingChangeLogs.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 divide-y divide-slate-100">
                                            {matchingChangeLogs.slice(-4).reverse().map((log) => (
                                                <div key={log.id} className="pt-1.5 first:pt-0 text-[11px] text-slate-600 flex flex-col">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="font-semibold text-slate-800">
                                                            {log.field_name}
                                                        </span>
                                                        <span className="text-slate-400 text-[10px] shrink-0 font-mono">
                                                            {formatDate(log.created_at)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] flex items-center gap-1.5 text-slate-600 font-mono mt-0.5 flex-wrap">
                                                        <span className="text-amber-800 line-through truncate max-w-[200px]" title={log.old_value}>
                                                            {log.old_value}
                                                        </span>
                                                        <span className="text-slate-400">&rarr;</span>
                                                        <span className="text-emerald-800 font-bold truncate max-w-[200px]" title={log.new_value}>
                                                            {log.new_value}
                                                        </span>
                                                        <span className="text-slate-500 text-[10px] ml-auto font-sans">
                                                            by {log.user?.name || log.role || 'User'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs">

                        <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                                Reviewer Findings & Suspension Remarks:
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {comments.length} total remark{comments.length === 1 ? '' : 's'}
                            </span>
                        </div>

                        <div className="p-4 space-y-3">
                            {comments.length === 0 ? (
                                <div className="p-5 text-center text-xs sm:text-sm text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    No reviewer comments on this cell yet.
                                    {canComment && ' You may use the box below to write a finding or remark.'}
                                </div>
                            ) : (
                                comments.map((c) => {
                                    const isPending = c.status === 'pending';
                                    const canDeleteComment =
                                        currentUser &&
                                        ['admin', 'super_admin'].includes(currentUser.role);

                                    return (
                                        <div
                                            key={c.id}
                                            className={`p-3.5 sm:p-4 rounded-xl border transition ${
                                                isPending
                                                    ? 'bg-red-50/60 border-red-200 ring-1 ring-red-300/50'
                                                    : 'bg-emerald-50/50 border-emerald-200'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                                                        {c.reviewer_name?.charAt(0) || 'R'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-900 text-xs sm:text-sm truncate leading-tight">
                                                            {c.reviewer_name}
                                                        </div>
                                                        <div className="text-[11px] font-semibold text-slate-500 truncate">
                                                            {c.reviewer_role}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
                                                            isPending
                                                                ? 'bg-red-100 text-red-800 border border-red-300'
                                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                        }`}
                                                    >
                                                        {isPending ? 'Action Required' : 'Complied ✓'}
                                                    </span>
                                                    {canDeleteComment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                                            title="Delete comment"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap break-words leading-relaxed pl-9">
                                                {c.comment}
                                            </p>

                                            <div className="text-[11px] text-slate-400 mt-1.5 pl-9 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{formatDate(c.created_at)}</span>
                                            </div>

                                            {!isPending && (
                                                <div className="mt-2.5 pt-2 border-t border-emerald-200/80 bg-white/80 p-2.5 rounded-lg text-xs text-emerald-900 space-y-1 ml-9">
                                                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        <span>Complied by {c.complied_by_user?.name || 'End-User'}</span>
                                                        {c.complied_at && (
                                                            <span className="text-[11px] text-emerald-600 font-normal">
                                                                ({formatDate(c.complied_at)})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {c.compliance_note && (
                                                        <p className="text-slate-700 italic text-xs pl-5 break-words">
                                                            "{c.compliance_note}"
                                                        </p>
                                                    )}
                                                    {canComply && (
                                                        <div className="pt-1 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUncomply(c.id)}
                                                                className="text-[11px] text-slate-500 hover:text-slate-700 underline font-semibold cursor-pointer"
                                                            >
                                                                Reopen for compliance
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {comments.length > 0 && pendingComments.length === 0 && (
                            <div className="bg-emerald-50 border-t border-emerald-200 p-3.5 flex items-center justify-between gap-2 text-emerald-900">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="text-xs font-bold">
                                        All reviewer remarks on this cell have been complied with.
                                    </span>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-950 uppercase tracking-wide">
                                    All Complied ✓
                                </span>
                            </div>
                        )}

                        {(onUpdateCellValue || canComply) && pendingComments.length > 0 && (
                            <div className="border-t-2 border-blue-200 bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-slate-50 p-4 sm:p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                                            <Edit3 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-extrabold text-blue-950 uppercase tracking-wide">
                                                Edit Cell Value for Compliance
                                            </h4>
                                            <p className="text-[11px] text-blue-800/80 font-medium">
                                                Directly update and apply the corrected value to this cell according to reviewer instructions.
                                            </p>
                                        </div>
                                    </div>
                                    {editSuccess && (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 animate-in fade-in">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            Cell Updated!
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                                        {fieldLabel || fieldKey} Value:
                                    </label>
                                    {renderDynamicCellInput()}
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                                    {onUpdateCellValue && (
                                        <button
                                            type="button"
                                            onClick={() => handleApplyEdit(false)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm cursor-pointer"
                                            title="Apply changes to cell"
                                        >
                                            <Save className="w-4 h-4" />
                                            <span>Apply to Cell</span>
                                        </button>
                                    )}

                                    {pendingComments.length > 0 && canComply && (
                                        <button
                                            type="button"
                                            disabled={loadingAction}
                                            onClick={() => handleApplyEdit(true)}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wide transition shadow-sm cursor-pointer disabled:opacity-50"
                                            title="Apply new value to cell and mark all reviewer comments as complied"
                                        >
                                            {loadingAction ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                            <span>Apply & Mark as Complied</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {canComment && (
                    <form onSubmit={handlePostComment} className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label className="block text-[11px] font-bold uppercase text-slate-700">
                                Add Reviewer Comment / Suspension Remark:
                            </label>
                            <span
                                className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${
                                    commentWordCount >= MAX_COMMENT_WORDS
                                        ? 'bg-rose-100 text-rose-700 border-rose-300'
                                        : commentWordCount >= 900
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                            >
                                {commentWordCount.toLocaleString()} / {MAX_COMMENT_WORDS.toLocaleString()} words
                            </span>
                        </div>
                        <div className="relative">
                            <textarea
                                rows={2}
                                value={newComment}
                                onChange={handleCommentChange}
                                placeholder="Type finding or correction needed for this cell (max 1,000 words)..."
                                className="w-full text-xs sm:text-sm p-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none resize-none bg-white leading-tight shadow-inner"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim() || loadingAction || isOverWordLimit}
                                className="absolute right-2.5 bottom-3.5 p-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                                title="Post comment to cell"
                            >
                                {loadingAction ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                            <p className="text-[10px] text-slate-500">
                                💡 Cell comments automatically form the suspension remarks for the End User to comply with (max 1,000 words).
                            </p>
                            {commentWordCount >= MAX_COMMENT_WORDS && (
                                <span className="text-[10px] font-bold text-rose-600 shrink-0">
                                    Maximum 1,000-word limit reached
                                </span>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
};
