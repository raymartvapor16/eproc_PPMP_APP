import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ppmpService, procurementConditionService, otherTermService, supportingDocumentService, procurementModeService, officeService, notificationService } from '../../services/api';
import { ProcurementPlanTable } from '../../components/PPMP/ProcurementPlanTable';
import { SourceOfFundCombobox } from '../../components/PPMP/SourceOfFundCombobox';
import { CommentableCell } from '../../components/PPMP/CommentableCell';
import { GreenSpecDropdown } from '../../components/PPMP/GreenSpecDropdown';
import { ArrowLeft, Save, Send, AlertCircle, AlertTriangle, CheckCircle2, FileCheck, Truck, Sparkles, Lock, Leaf, MessageSquare, CheckCheck, Building2, Search, ChevronDown, X, Loader2 } from 'lucide-react';
import {
    BASE_DELIVERY_PERIODS,
    BASE_PLACES_OF_DELIVERY,
    BASE_PAYMENT_METHODS,
    canonicalizeDeliveryPeriod,
    canonicalizePlaceOfDelivery,
    canonicalizePaymentMethod,
    deduplicateOptions,
    findMatchingOption,
} from '../../utils/procurementOptions';
import { sanitizeFiscalYear } from '../../utils/fiscalYears';

export const POL_TERMS_TEXT = `POL Condition:
-Staggered Delivery based on the latest fuel pump price /At Gasoline Station
-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.
-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings and will resume only after the outstanding obligations are settled.`;

export const PPMPFormPage = ({
    user,
    initialPpmp = null,
    initialSourceOfFund = 'General Fund',
    initialWorkflowRoute = null,
    onBack,
    onSaved,
}) => {
    const isEditMode = !!initialPpmp;

    const isAttachmentOnly = Boolean(
        isEditMode &&
        (initialPpmp?.amendment_scope === 'ATTACHMENT_LIST' || initialPpmp?.amendment?.amendment_scope === 'ATTACHMENT_LIST') &&
        !['admin', 'super_admin'].includes(user?.role)
    );

    const resolvedInitialRoute = initialWorkflowRoute ||
        initialPpmp?.fund_source_ref?.workflow_route ||
        initialPpmp?.workflow_route ||
        (initialPpmp?.source_of_fund?.toLowerCase().includes('trust') ? 'pacco' : null) ||
        (initialSourceOfFund?.toLowerCase().includes('trust') ? 'pacco' : 'budget');

    const [workflowRoute, setWorkflowRoute] = useState(resolvedInitialRoute || 'budget');

    const cleanInitialFund = (initialPpmp?.source_of_fund === 'General Fund and etc..' ? 'General Fund' : initialPpmp?.source_of_fund) ||
        (initialSourceOfFund === 'General Fund and etc..' ? 'General Fund' : initialSourceOfFund) ||
        (resolvedInitialRoute === 'pacco' ? 'Trust Fund' : 'General Fund');

    const [sourceOfFund, setSourceOfFund] = useState(cleanInitialFund);
    const [fundSourceId, setFundSourceId] = useState(initialPpmp?.fund_source_id || null);
    const [trackingNumber, setTrackingNumber] = useState(
        initialPpmp?.tracking_number ? String(initialPpmp.tracking_number) : ''
    );
    const [trackerManuallyEdited, setTrackerManuallyEdited] = useState(isEditMode);
    const [loadingAutoTracker, setLoadingAutoTracker] = useState(false);
    const [trackerStatus, setTrackerStatus] = useState({
        checking: false,
        available: true,
        exists: false,
        message: '',
    });
    const [ppmpNumber, setPpmpNumber] = useState(
        (initialPpmp?.ppmp_number !== undefined && initialPpmp?.ppmp_number !== null) ? initialPpmp.ppmp_number : ''
    );
    const [title, setTitle] = useState(initialPpmp?.title || '');
    const [accountCode, setAccountCode] = useState(initialPpmp?.account_code || '');
    const [accountCodeId, setAccountCodeId] = useState(initialPpmp?.account_code_id || null);
    const [fiscalYear, setFiscalYear] = useState(initialPpmp?.fiscal_year || new Date().getFullYear().toString());
    const [planType, setPlanType] = useState(initialPpmp?.plan_type || 'INDICATIVE');

    const [offices, setOffices] = useState([]);
    const [loadingOffices, setLoadingOffices] = useState(false);
    const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
    const [officeSearchTerm, setOfficeSearchTerm] = useState('');
    const officeDropdownRef = useRef(null);

    const formatOfficeOption = (office) => {
        if (!office) return '';
        const code = (office.code || '').trim();
        const name = (office.name || '').trim();
        if (code && code !== 'NA') {
            if (name.startsWith(`(${code})`)) {
                return name;
            }
            return `(${code}) ${name}`;
        }
        return name;
    };

    const defaultUserOffice = user?.office?.code && user?.office?.name
        ? (user.office.code !== 'NA' ? `(${user.office.code}) ${user.office.name}` : user.office.name)
        : (user?.office?.name || '');

    const [implementingUnit, setImplementingUnit] = useState(
        initialPpmp?.implementing_unit || initialPpmp?.office?.name || defaultUserOffice
    );
    const [programName, setProgramName] = useState(initialPpmp?.program_name || '');
    const [programNameId, setProgramNameId] = useState(initialPpmp?.program_name_id || null);
    const [deliveryPeriod, setDeliveryPeriod] = useState(initialPpmp?.delivery_period || '');
    const [placeOfDelivery, setPlaceOfDelivery] = useState(initialPpmp?.place_of_delivery || '');
    const [paymentMethod, setPaymentMethod] = useState(initialPpmp?.payment_method || '');
    const [additionalCondition, setAdditionalCondition] = useState(initialPpmp?.additional_condition || '');
    const [warrantyAndOtherTerms, setWarrantyAndOtherTerms] = useState(initialPpmp?.warranty_and_other_terms || '');

    const [conditions, setConditions] = useState([]);
    const [loadingConditions, setLoadingConditions] = useState(false);

    const [otherTermsList, setOtherTermsList] = useState([]);
    const [loadingOtherTerms, setLoadingOtherTerms] = useState(false);
    const [selectedOtherTermId, setSelectedOtherTermId] = useState('');

    const [supportingDocsList, setSupportingDocsList] = useState([]);

    const [procurementModesList, setProcurementModesList] = useState([]);

    const [cellComments, setCellComments] = useState(initialPpmp?.cell_comments || initialPpmp?.cellComments || []);
    const [activeHeaderCellKey, setActiveHeaderCellKey] = useState(null);

    const fetchCellComments = () => {
        if (initialPpmp?.uuid) {
            ppmpService.getCellComments(initialPpmp.uuid).then(res => {
                if (res.data?.data) {
                    setCellComments(res.data.data);
                }
            }).catch(e => {
                console.error('Error fetching cell comments:', e);
            });
        }
    };

    useEffect(() => {
        if (initialPpmp?.cell_comments || initialPpmp?.cellComments) {
            setCellComments(initialPpmp.cell_comments || initialPpmp.cellComments);
        }
        fetchCellComments();
    }, [initialPpmp?.uuid, initialPpmp?.updated_at, initialPpmp?.status]);

    useEffect(() => {
        const cleanVal = String(trackingNumber || '').replace(/\s+/g, '').trim().toUpperCase();
        const initialVal = String(initialPpmp?.tracking_number || '').replace(/\s+/g, '').trim().toUpperCase();

        if (!cleanVal) {
            setTrackerStatus({
                checking: false,
                available: true,
                exists: false,
                message: isEditMode ? 'Tracker No. is required.' : 'Leave blank to auto-generate official Tracker No.',
            });
            return;
        }

        if (isEditMode && cleanVal === initialVal) {
            setTrackerStatus({
                checking: false,
                available: true,
                exists: false,
                message: 'Current assigned Tracker No.',
            });
            return;
        }

        let cancelled = false;
        setTrackerStatus(prev => ({ ...prev, checking: true, message: 'Checking availability...' }));

        const timer = setTimeout(async () => {
            try {
                const res = await ppmpService.checkTrackerAvailability({
                    tracking_number: cleanVal,
                    exclude_uuid: initialPpmp?.uuid || undefined,
                });
                if (cancelled) return;
                setTrackerStatus({
                    checking: false,
                    available: Boolean(res.data?.available),
                    exists: Boolean(res.data?.exists),
                    message: res.data?.message || '',
                });
            } catch (err) {
                if (cancelled) return;
                setTrackerStatus({
                    checking: false,
                    available: true,
                    exists: false,
                    message: '',
                });
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trackingNumber, initialPpmp?.tracking_number, initialPpmp?.uuid, isEditMode]);

    const handleAddCellComment = async (commentData) => {
        if (!initialPpmp?.uuid) return;
        try {
            const res = await ppmpService.addCellComment(initialPpmp.uuid, commentData);
            const newComment = res.data?.data;
            if (newComment) {
                setCellComments(prev => [newComment, ...prev]);
            }
            return res.data;
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to post cell comment.');
            throw err;
        }
    };

    const handleDeleteCellComment = async (commentId) => {
        if (!initialPpmp?.uuid) return;
        try {
            await ppmpService.deleteCellComment(initialPpmp.uuid, commentId);
            setCellComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete cell comment.');
            throw err;
        }
    };

    const handleComplyCellComment = async (commentId, complianceNote) => {
        if (!initialPpmp?.uuid) return;
        try {
            const res = await ppmpService.complyCellComment(initialPpmp.uuid, commentId, { compliance_note: complianceNote });
            const updated = res.data?.data;
            if (updated) {
                setCellComments(prev => prev.map(c => c.id === commentId ? updated : c));
            }
            return res.data;
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to mark compliance.');
            throw err;
        }
    };

    const handleUncomplyCellComment = async (commentId) => {
        if (!initialPpmp?.uuid) return;
        try {
            const res = await ppmpService.uncomplyCellComment(initialPpmp.uuid, commentId);
            const updated = res.data?.data;
            if (updated) {
                setCellComments(prev => prev.map(c => c.id === commentId ? updated : c));
            }
            return res.data;
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to unmark compliance.');
            throw err;
        }
    };

    const isSuspended = ['HEAD_RETURNED', 'BUDGET_OFFICER_RETURNED', 'PACCO_RETURNED', 'OPPMO_RETURNED', 'TWG_RETURNED'].includes(initialPpmp?.status) || (typeof initialPpmp?.status === 'string' && initialPpmp.status.endsWith('_RETURNED'));
    const isReviewerRole = ['head', 'authorized_staff', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin'].includes(user?.role);
    const canComment = isReviewerRole;
    const canComply = isSuspended || ['admin', 'super_admin'].includes(user?.role);

    const visibleCellComments = (isReviewerRole || isSuspended)
        ? (cellComments || [])
        : (cellComments || []).filter(c => c.status === 'complied');
    const canViewCellComments = isReviewerRole || isSuspended || visibleCellComments.length > 0;
    const pendingCellComments = visibleCellComments.filter(c => c.status === 'pending');
    const compliedCellComments = visibleCellComments.filter(c => c.status === 'complied');

    const isPolCondition = additionalCondition === 'POL Condition';

    useEffect(() => {
        let isMounted = true;
        const fetchConditions = async () => {
            setLoadingConditions(true);
            try {
                const res = await procurementConditionService.getAll({ active_only: 1, with_options: 1 });
                if (isMounted) {
                    if (res.data?.conditions) {
                        setConditions(res.data.conditions);
                    } else if (Array.isArray(res.data)) {
                        setConditions(res.data);
                    }
                }
            } catch (err) {
                console.error('Failed to load procurement conditions', err);
            } finally {
                if (isMounted) setLoadingConditions(false);
            }
        };
        fetchConditions();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchOtherTerms = async () => {
            setLoadingOtherTerms(true);
            try {
                const res = await otherTermService.getAll({ active_only: 1 });
                if (isMounted) {
                    setOtherTermsList(Array.isArray(res.data) ? res.data : []);
                }
            } catch (err) {
                console.error('Failed to load other terms / green specs', err);
            } finally {
                if (isMounted) setLoadingOtherTerms(false);
            }
        };
        fetchOtherTerms();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchSupportingDocs = async () => {
            try {
                const res = await supportingDocumentService.getAll({ active_only: 1 });
                if (isMounted) {
                    setSupportingDocsList(Array.isArray(res.data) ? res.data : []);
                }
            } catch (err) {
                console.error('Failed to load supporting documents', err);
            }
        };
        fetchSupportingDocs();

        const handleDocsChanged = () => {
            if (isMounted) fetchSupportingDocs();
        };
        window.addEventListener('supporting-documents:changed', handleDocsChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('supporting-documents:changed', handleDocsChanged);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchModes = async () => {
            try {
                const res = await procurementModeService.getAll({ active_only: 1 });
                if (isMounted) {
                    setProcurementModesList(Array.isArray(res.data) ? res.data : []);
                }
            } catch (err) {
                console.error('Failed to load modes of procurement', err);
            }
        };
        fetchModes();

        const handleModesChanged = () => {
            if (isMounted) fetchModes();
        };
        window.addEventListener('procurement-modes:changed', handleModesChanged);

        return () => {
            isMounted = false;
            window.removeEventListener('procurement-modes:changed', handleModesChanged);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchOffices = async () => {
            setLoadingOffices(true);
            try {
                const res = await officeService.getAll();
                if (isMounted && res.data) {
                    const validOffices = (res.data || []).filter(o => o && o.name && o.name !== 'NA');
                    setOffices(validOffices);
                }
            } catch (err) {
                console.error('Failed to load offices for PPMP form', err);
                try {
                    const fallback = await notificationService.getOffices();
                    if (isMounted && fallback.data) {
                        const validOffices = (fallback.data || []).filter(o => o && o.name && o.name !== 'NA');
                        setOffices(validOffices);
                    }
                } catch (fallbackErr) {
                    console.error('Failed fallback offices fetch', fallbackErr);
                }
            } finally {
                if (isMounted) setLoadingOffices(false);
            }
        };
        fetchOffices();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (officeDropdownRef.current && !officeDropdownRef.current.contains(e.target)) {
                setIsOfficeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOffices = useMemo(() => {
        const term = officeSearchTerm.trim().toLowerCase();
        if (!term) return offices;
        return offices.filter(o => {
            const code = (o.code || '').toLowerCase();
            const name = (o.name || '').toLowerCase();
            const combined = formatOfficeOption(o).toLowerCase();
            return code.includes(term) || name.includes(term) || combined.includes(term);
        });
    }, [offices, officeSearchTerm]);

    const { cseTerms, nonCseTerms, generalTerms } = useMemo(() => {
        const cse = [];
        const nonCse = [];
        const general = [];
        otherTermsList.forEach((t) => {
            const cat = (t.category || '').toUpperCase();
            if (cat === 'CSE') cse.push(t);
            else if (cat === 'NON-CSE') nonCse.push(t);
            else general.push(t);
        });
        return { cseTerms: cse, nonCseTerms: nonCse, generalTerms: general };
    }, [otherTermsList]);

    const handleOtherTermSelect = (termId) => {
        setSelectedOtherTermId(termId);
        if (!termId || termId === 'CUSTOM') {
            return;
        }
        const found = otherTermsList.find((t) => String(t.id) === String(termId));
        if (found && found.description) {
            setWarrantyAndOtherTerms(found.description);
        }
    };

    const handleAppendOtherTerm = (termId) => {
        if (!termId || termId === 'CUSTOM') return;
        const found = otherTermsList.find((t) => String(t.id) === String(termId));
        if (found && found.description) {
            setWarrantyAndOtherTerms((prev) => {
                if (!prev || !prev.trim()) return found.description;
                return `${prev.trim()}\n\n${found.description}`;
            });
        }
    };

    const currentSelectedTermId = useMemo(() => {
        if (selectedOtherTermId) return selectedOtherTermId;
        if (!warrantyAndOtherTerms) return '';
        const match = otherTermsList.find((t) => t.description.trim() === warrantyAndOtherTerms.trim());
        return match ? String(match.id) : 'CUSTOM';
    }, [selectedOtherTermId, warrantyAndOtherTerms, otherTermsList]);

    const handleConditionSelect = (conditionName) => {
        setAdditionalCondition(conditionName);
        if (!conditionName) {
            if (warrantyAndOtherTerms === POL_TERMS_TEXT) {
                setWarrantyAndOtherTerms('');
            }
            return;
        }

        const found = conditions.find(c => c.name === conditionName);

        if (conditionName === 'POL Condition') {

            const polText = found?.other_terms || POL_TERMS_TEXT;
            setWarrantyAndOtherTerms(polText);

            setDeliveryPeriod('');
            setPlaceOfDelivery('');
            setPaymentMethod('');
            return;
        }

        if (warrantyAndOtherTerms === POL_TERMS_TEXT) {
            setWarrantyAndOtherTerms('');
        }

        if (found) {
            setPlaceOfDelivery(found.place_of_delivery || '');
            setDeliveryPeriod(found.delivery_period || '');
            setPaymentMethod(found.payment_method || '');

        }
    };

    const deliveryPeriodOptions = useMemo(() => {
        const pool = [...BASE_DELIVERY_PERIODS];
        conditions.forEach(c => {
            if (c.delivery_period) pool.push(c.delivery_period);
        });
        return deduplicateOptions(pool, canonicalizeDeliveryPeriod);
    }, [conditions]);

    const placeOfDeliveryOptions = useMemo(() => {
        const pool = [...BASE_PLACES_OF_DELIVERY];
        conditions.forEach(c => {
            if (c.place_of_delivery) pool.push(c.place_of_delivery);
        });
        return deduplicateOptions(pool, canonicalizePlaceOfDelivery);
    }, [conditions]);

    const paymentMethodOptions = useMemo(() => {
        const pool = [...BASE_PAYMENT_METHODS];
        conditions.forEach(c => {
            if (c.payment_method) pool.push(c.payment_method);
        });
        return deduplicateOptions(pool, canonicalizePaymentMethod);
    }, [conditions]);

    const defaultFund = (initialPpmp?.source_of_fund === 'General Fund and etc..' ? '' : initialPpmp?.source_of_fund) || '';
    const [items, setItems] = useState(() => {
        if (initialPpmp?.items?.length) {
            return initialPpmp.items.map(it => {
                const b = parseFloat(it.estimated_budget) || 0;
                const cleanFund = it.source_of_fund === 'General Fund and etc..' ? '' : (it.source_of_fund || '');
                return {
                    ...it,
                    is_retention: Boolean(it.is_retention),
                    retention_percentage: it.retention_percentage ?? null,
                    description: it.description || '',
                    quantity_size: it.quantity_size || '',
                    source_of_fund: cleanFund,
                    start_date: it.start_date || '',
                    end_date: it.end_date || '',
                    delivery_period: it.delivery_period || '',
                    supporting_docs_text: it.supporting_docs_text || '',
                    remarks: it.remarks || '',
                    estimated_budget: (it.estimated_budget !== null && it.estimated_budget !== undefined && it.estimated_budget !== '') ? it.estimated_budget : (initialPpmp?.is_continuation ? '' : 0),
                    pre_proc_conference: b >= 5000000 ? true : !!it.pre_proc_conference,
                };
            });
        }
        return [
            {
                description: '',
                project_type: 'Goods',
                quantity_size: '',
                procurement_mode: 'Competitive Bidding (RA 12009)',
                pre_proc_conference: false,
                start_date: '',
                end_date: '',
                delivery_period: '',
                source_of_fund: sourceOfFund,
                fund_source_id: fundSourceId,
                estimated_budget: 0,
                supporting_docs_text: '',
                remarks: '',
            }
        ];
    });

    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const primaryProjectType = useMemo(() => {
        const firstTyped = items.find((it) => it && !it.is_header && it.project_type);
        return firstTyped?.project_type || 'Goods';
    }, [items]);

    useEffect(() => {
        if (isEditMode || trackerManuallyEdited) return;
        let cancelled = false;
        setLoadingAutoTracker(true);

        const timer = setTimeout(async () => {
            try {
                const res = await ppmpService.getNextTrackerNumber({
                    implementing_unit: implementingUnit || '',
                    project_type: primaryProjectType || 'Goods',
                    fiscal_year: fiscalYear || new Date().getFullYear().toString(),
                });
                if (!cancelled && res.data?.tracking_number) {
                    setTrackingNumber(String(res.data.tracking_number).toUpperCase());
                }
            } catch (err) {
                console.warn('Failed to auto-generate preview tracker number:', err);
            } finally {
                if (!cancelled) setLoadingAutoTracker(false);
            }
        }, 150);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isEditMode, trackerManuallyEdited, implementingUnit, primaryProjectType, fiscalYear]);

    const totalBudget = items.reduce((sum, item) => sum + (parseFloat(item.estimated_budget) || 0), 0);

    const isContinuation = !!initialPpmp?.is_continuation;
    const baselineAnnualBudget = parseFloat(initialPpmp?.baseline_annual_budget) || 0;
    const isBudgetExceeded = isContinuation && baselineAnnualBudget > 0 && totalBudget > (baselineAnnualBudget + 0.01);

    const isTrustFund = workflowRoute === 'pacco';

    const handleSwitchRoute = (newRoute) => {
        if (newRoute === workflowRoute) return;
        setWorkflowRoute(newRoute);
        const defaultName = newRoute === 'pacco' ? 'Trust Fund' : 'General Fund';
        handleFundChange(defaultName, null);
    };

    const isUnderReviewOrOnReviewer = isEditMode && (
        [
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'BUDGET_OFFICER_REVIEW',
            'PACCO_REVIEW',
            'OPPMO_REVIEW',
            'TWG_REVIEW',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED',
            'READY_TO_PRINT'
        ].includes(initialPpmp?.status) ||
        (initialPpmp?.status && initialPpmp.status !== 'DRAFT')
    );

    const handleFundChange = (newFund, newFundId = null) => {
        setSourceOfFund(newFund);
        if (newFundId !== undefined && newFundId !== null) {
            setFundSourceId(newFundId);
        }

        setItems(prevItems => prevItems.map(item => ({
            ...item,
            source_of_fund: item.source_of_fund === sourceOfFund || !item.source_of_fund ? newFund : item.source_of_fund,
            fund_source_id: item.source_of_fund === sourceOfFund || !item.source_of_fund ? (newFundId || fundSourceId) : item.fund_source_id,
        })));
    };

    const handleAddItem = (customItem = null) => {
        if (customItem && customItem.is_header) {
            setItems([
                ...items,
                {
                    is_header: true,
                    description: customItem.description || '',
                    project_type: '',
                    quantity_size: '',
                    procurement_mode: '',
                    pre_proc_conference: false,
                    start_date: '',
                    end_date: '',
                    delivery_period: '',
                    source_of_fund: '',
                    estimated_budget: 0,
                    supporting_docs_text: '',
                    remarks: '',
                }
            ]);
            return;
        }

        const defaultProcMode = procurementModesList[0]?.name || 'Competitive Bidding (RA 12009)';
        setItems([
            ...items,
            {
                is_header: false,
                is_retention: false,
                retention_percentage: null,
                description: '',
                project_type: 'Goods',
                quantity_size: '',
                procurement_mode: defaultProcMode,
                pre_proc_conference: false,
                start_date: '',
                end_date: '',
                delivery_period: '',
                source_of_fund: sourceOfFund,
                fund_source_id: fundSourceId,
                estimated_budget: 0,
                supporting_docs_text: '',
                remarks: '',
            }
        ]);
    };

    const handleAddRetention = ({ percentage = 10, deductFromItems = true } = {}) => {
        const pct = Math.max(0, Math.min(100, parseFloat(percentage) || 0));
        const defaultProcMode = procurementModesList[0]?.name || 'Competitive Bidding (RA 12009)';

        setItems(prevItems => {
            const regularEntries = prevItems
                .map((it, idx) => ({ it, idx, budget: parseFloat(it.estimated_budget) || 0 }))
                .filter(e => !e.it.is_header && !e.it.is_retention);

            const regularTotal = regularEntries.reduce((sum, e) => sum + e.budget, 0);
            const firstRegular = regularEntries[0]?.it || null;

            let retentionAmount = 0;
            let nextItems = prevItems.map(it => ({ ...it }));

            if (deductFromItems && regularTotal > 0 && pct > 0) {
                retentionAmount = Math.round(regularTotal * (pct / 100) * 100) / 100;
                let remainingToDeduct = retentionAmount;
                const positiveRegulars = regularEntries.filter(e => e.budget > 0);

                positiveRegulars.forEach((entry, i) => {
                    const isLast = i === positiveRegulars.length - 1;
                    const deduction = isLast
                        ? Math.round(remainingToDeduct * 100) / 100
                        : Math.round((entry.budget / regularTotal) * retentionAmount * 100) / 100;
                    const newBudget = Math.max(0, Math.round((entry.budget - deduction) * 100) / 100);
                    remainingToDeduct = Math.round((remainingToDeduct - deduction) * 100) / 100;
                    nextItems[entry.idx] = {
                        ...nextItems[entry.idx],
                        estimated_budget: newBudget,
                        pre_proc_conference: newBudget >= 5000000 ? true : nextItems[entry.idx].pre_proc_conference,
                    };
                });
            }

            const pctLabel = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
            nextItems.push({
                is_header: false,
                is_retention: true,
                retention_percentage: pct,
                description: '',
                project_type: firstRegular?.project_type || 'Goods',
                quantity_size: '',
                procurement_mode: firstRegular?.procurement_mode || defaultProcMode,
                pre_proc_conference: retentionAmount >= 5000000,
                start_date: firstRegular?.start_date || '',
                end_date: firstRegular?.end_date || '',
                delivery_period: firstRegular?.delivery_period || '',
                source_of_fund: firstRegular?.source_of_fund || sourceOfFund,
                fund_source_id: firstRegular?.fund_source_id || fundSourceId,
                estimated_budget: retentionAmount,
                supporting_docs_text: '',
                remarks: `${pctLabel}% Retention`,
            });

            return nextItems;
        });
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) {
            alert('A PPMP must contain at least one procurement item.');
            return;
        }
        setItems(items.filter((_, idx) => idx !== index));
    };

    const handleUpdateItem = (index, field, value) => {
        setItems(prevItems => {
            const updated = [...prevItems];
            if (!updated[index]) return prevItems;

            if (field === 'estimated_budget') {
                const numVal = parseFloat(value) || 0;
                const wasAbove5M = (parseFloat(updated[index].estimated_budget) || 0) >= 5000000;
                updated[index] = {
                    ...updated[index],
                    estimated_budget: value,

                    pre_proc_conference: numVal >= 5000000
                        ? true
                        : (wasAbove5M ? false : updated[index].pre_proc_conference),
                };
            } else {
                updated[index] = { ...updated[index], [field]: value };
            }
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (isAttachmentOnly) {
            setErrorMessage('PPMP procurement items and plan details are locked for this revision. The approved request scope is restricted to the Detailed Specifications only.');
            return;
        }

        if (!title.trim()) {
            setErrorMessage('Please provide a descriptive Project Title / Objective.');
            return;
        }

        const invalidItem = items.filter(i => !i.is_header).find(item => !item.description?.trim());
        if (invalidItem) {
            setErrorMessage('All item rows must have a description.');
            return;
        }

        const cleanTracker = String(trackingNumber || '').replace(/\s+/g, '').trim().toUpperCase();
        if (isEditMode && !cleanTracker) {
            setErrorMessage('Please provide a valid Tracker No.');
            return;
        }
        if (trackerStatus.exists) {
            setErrorMessage(trackerStatus.message || `Tracker No. "${cleanTracker}" already exists. Duplicate tracker numbers are not allowed.`);
            return;
        }

        if (isBudgetExceeded) {
            setErrorMessage(`Total estimated budget (₱${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) exceeds the baseline Annual PPMP budgetary allocation of ₱${baselineAnnualBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
            return;
        }

        setLoading(true);

        const derivedSourceOfFund = items.find(i => i.source_of_fund && !i.is_header)?.source_of_fund || sourceOfFund || 'General Fund';
        const derivedFundSourceId = items.find(i => i.fund_source_id && !i.is_header)?.fund_source_id || fundSourceId || null;

        const payload = {
            tracking_number: cleanTracker || null,
            ppmp_number: String(ppmpNumber ?? '').trim(),
            title: title.trim(),
            source_of_fund: derivedSourceOfFund,
            fund_source_id: derivedFundSourceId,
            account_code: accountCode.trim(),
            account_code_id: accountCodeId || null,
            fiscal_year: sanitizeFiscalYear(fiscalYear) || String(new Date().getFullYear()),
            plan_type: planType,
            implementing_unit: implementingUnit.trim(),
            program_name: programName ? programName.trim() : null,
            program_name_id: programNameId || null,
            delivery_period: isPolCondition ? '' : deliveryPeriod,
            place_of_delivery: isPolCondition ? '' : placeOfDelivery,
            payment_method: isPolCondition ? '' : paymentMethod,
            additional_condition: additionalCondition,
            warranty_and_other_terms: warrantyAndOtherTerms,
            items: items.map(item => ({
                ...item,
                is_retention: Boolean(item.is_retention),
                retention_percentage: item.is_retention && item.retention_percentage !== null && item.retention_percentage !== ''
                    ? (parseFloat(item.retention_percentage) || 0)
                    : null,
                fund_source_id: item.fund_source_id || fundSourceId || null,
                estimated_budget: parseFloat(item.estimated_budget) || 0,
            })),
        };

        try {
            let res;
            if (isEditMode) {
                res = await ppmpService.update(initialPpmp.uuid, payload);
            } else {
                res = await ppmpService.create(payload);
            }

            if (onSaved) onSaved(res.data.ppmp);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Failed to save PPMP draft.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={loading || isAttachmentOnly || trackerStatus.exists}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition ${
                            isAttachmentOnly || trackerStatus.exists
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                        }`}
                        title={
                            isAttachmentOnly
                                ? 'PPMP procurement items are locked for this revision.'
                                : trackerStatus.exists
                                    ? trackerStatus.message
                                    : ''
                        }
                    >
                        {isAttachmentOnly ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {loading ? 'Saving...' : isAttachmentOnly ? 'PPMP Items Locked' : isEditMode ? 'Save Changes' : 'Save as Draft'}
                    </button>
                </div>
            </div>

            {isAttachmentOnly && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="font-bold uppercase tracking-wider block text-amber-950">Scope Restricted Revision</span>
                            <span>The approved request scope is restricted to updating the <strong>Detailed Specifications</strong> only. Procurement items and plan details cannot be edited.</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 transition"
                    >
                        Return to PPMP Details
                    </button>
                </div>
            )}

            {isContinuation && (
                <div className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs transition ${
                    isBudgetExceeded
                        ? 'bg-rose-50/90 border-rose-300 text-rose-900'
                        : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                }`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg mt-0.5 ${isBudgetExceeded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isBudgetExceeded ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div>
                            <span className="font-bold uppercase tracking-wider block">
                                Supplemental Continuation (CY {fiscalYear || new Date().getFullYear()})
                            </span>
                            <span className="leading-relaxed">
                                Baseline Annual Allocation Ceiling: <strong>₱{baselineAnnualBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                {' '}&bull;{' '}Current Total Budget: <strong>₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                {isBudgetExceeded && (
                                    <span className="block text-rose-700 font-bold mt-1">
                                        ⚠️ Budget allocation exceeded by ₱{(totalBudget - baselineAnnualBudget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}! Estimated budget cannot exceed the initial Annual PPMP budget.
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-800 text-xs font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="border-b border-slate-200 pb-4 mb-6 text-center">
                    <span className="text-xs uppercase font-medium text-slate-500 tracking-wider">
                        Republic of the Philippines
                    </span>
                    <h2 className="text-lg font-black uppercase text-slate-900 tracking-wide">
                        PROVINCIAL GOVERNMENT OF DAVAO DEL SUR
                    </h2>
                    <div className="text-xs font-semibold text-slate-600 mt-0.5">
                        Matti, Digos City
                    </div>
                    <div className="text-xs font-bold text-blue-900 uppercase tracking-widest mt-1">
                        PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP)
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                    <CommentableCell
                        as="div"
                        fieldKey="tracking_number"
                        fieldLabel="Tracker No."
                        cellValue={trackingNumber}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setTrackingNumber(String(newVal || '').toUpperCase())}
                        className="p-1 rounded-md"
                    >
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="block text-xs font-bold text-slate-700 uppercase">
                                Tracker No.: <span className="text-rose-600">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                                {!isEditMode && trackerManuallyEdited && (
                                    <button
                                        type="button"
                                        onClick={() => setTrackerManuallyEdited(false)}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                        title="Reset to auto-generated Tracker No."
                                    >
                                        Auto
                                    </button>
                                )}
                                {(trackerStatus.checking || loadingAutoTracker) && (
                                    <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {loadingAutoTracker ? 'Generating...' : 'Checking...'}
                                    </span>
                                )}
                                {!trackerStatus.checking && !loadingAutoTracker && trackerStatus.exists && (
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                        <AlertCircle className="w-2.5 h-2.5" /> Duplicate
                                    </span>
                                )}
                                {!trackerStatus.checking && !loadingAutoTracker && !trackerStatus.exists && trackingNumber?.trim() && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> Valid
                                    </span>
                                )}
                            </div>
                        </div>
                        <input
                            type="text"
                            required={isEditMode}
                            value={trackingNumber ?? ''}
                            onChange={(e) => {
                                setTrackerManuallyEdited(true);
                                setTrackingNumber(e.target.value.toUpperCase());
                            }}
                            className={`w-full text-xs p-2.5 border rounded-md focus:ring-2 focus:outline-none font-mono font-bold ${
                                trackerStatus.exists
                                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                                    : 'border-slate-300 text-slate-900 focus:ring-blue-500'
                            }`}
                            placeholder="e.g. PMOGOODS-2026-000001"
                        />
                        {trackerStatus.exists ? (
                            <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block leading-tight">
                                {trackerStatus.message || 'This Tracker No. already exists. Duplicate tracker numbers are not allowed.'}
                            </span>
                        ) : (
                            <span className="text-[10px] text-slate-400 mt-0.5 block leading-tight">
                                {isEditMode
                                    ? 'Editable unique Tracker No. (no duplicates allowed)'
                                    : 'Auto-generated unique Tracker No. — editable (no duplicates allowed)'}
                            </span>
                        )}
                    </CommentableCell>

                    <CommentableCell
                        as="div"
                        fieldKey="ppmp_number"
                        fieldLabel="PPMP No."
                        cellValue={ppmpNumber}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setPpmpNumber(newVal)}
                        className="p-1 rounded-md"
                    >
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            PPMP No.: <span className="text-rose-600">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={ppmpNumber ?? ''}
                            onChange={(e) => setPpmpNumber(e.target.value)}
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-900"
                            placeholder="e.g. 0, 1, 2, 3..."
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Official form sequential number</span>
                    </CommentableCell>

                    <CommentableCell
                        as="div"
                        fieldKey="fiscal_year"
                        fieldLabel="Fiscal Year"
                        cellValue={`CY ${fiscalYear}`}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setFiscalYear(newVal.replace(/^CY\s*/i, ''))}
                        className="p-1 rounded-md"
                    >
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Fiscal Year (CY): <span className="text-rose-600">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={fiscalYear ?? ''}
                            onChange={(e) => setFiscalYear(e.target.value)}
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder={new Date().getFullYear().toString()}
                        />
                    </CommentableCell>

                    <CommentableCell
                        as="div"
                        fieldKey="plan_type"
                        fieldLabel="Plan Type (INDICATIVE / FINAL)"
                        cellValue={planType}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setPlanType(newVal)}
                        className="p-1 rounded-md"
                    >
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Plan Type: <span className="text-rose-600">*</span>
                        </label>
                        <div className="flex items-center gap-6 mt-2">
                            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                <input
                                    type="radio"
                                    name="plan_type"
                                    value="INDICATIVE"
                                    checked={planType === 'INDICATIVE'}
                                    onChange={(e) => setPlanType(e.target.value)}
                                    className="text-blue-600 h-4 w-4"
                                />
                                INDICATIVE
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                <input
                                    type="radio"
                                    name="plan_type"
                                    value="FINAL"
                                    checked={planType === 'FINAL'}
                                    onChange={(e) => setPlanType(e.target.value)}
                                    className="text-blue-600 h-4 w-4"
                                />
                                FINAL
                            </label>
                        </div>
                    </CommentableCell>

                    <CommentableCell
                        as="div"
                        fieldKey="implementing_unit"
                        fieldLabel="End-User or Implementing Unit"
                        cellValue={implementingUnit}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setImplementingUnit(newVal)}
                        className="p-1 rounded-md"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 uppercase">
                                Implementing Office / Unit:
                            </label>
                            <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                (code)name
                            </span>
                        </div>

                        <div className="relative" ref={officeDropdownRef}>
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    required
                                    value={implementingUnit ?? ''}
                                    onChange={(e) => {
                                        setImplementingUnit(e.target.value);
                                        setOfficeSearchTerm(e.target.value);
                                        if (!isOfficeDropdownOpen) setIsOfficeDropdownOpen(true);
                                    }}
                                    onFocus={() => {
                                        setIsOfficeDropdownOpen(true);
                                    }}
                                    placeholder="Search office by (code) or name..."
                                    className="w-full text-xs p-2.5 pr-14 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900 shadow-sm"
                                />
                                <div className="absolute right-1.5 flex items-center gap-0.5">
                                    {implementingUnit && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setImplementingUnit('');
                                                setOfficeSearchTerm('');
                                            }}
                                            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition"
                                            title="Clear office selection"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsOfficeDropdownOpen(prev => !prev);
                                        }}
                                        className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition"
                                        title="Toggle office dropdown"
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOfficeDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {isOfficeDropdownOpen && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100">

                                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            value={officeSearchTerm}
                                            onChange={(e) => setOfficeSearchTerm(e.target.value)}
                                            placeholder="Filter by code (e.g. OPPMO, PBO) or name..."
                                            className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-800 placeholder-slate-400"
                                            autoFocus
                                        />
                                        {officeSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setOfficeSearchTerm('')}
                                                className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    <div className="overflow-y-auto divide-y divide-slate-100 max-h-56">
                                        {loadingOffices ? (
                                            <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                                                <span>Loading offices...</span>
                                            </div>
                                        ) : filteredOffices.length === 0 ? (
                                            <div className="p-4 text-center text-slate-400">
                                                No matching offices found
                                            </div>
                                        ) : (
                                            filteredOffices.map((office) => {
                                                const formatted = formatOfficeOption(office);
                                                const isSelected = implementingUnit === formatted;
                                                return (
                                                    <button
                                                        key={office.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setImplementingUnit(formatted);
                                                            setOfficeSearchTerm('');
                                                            setIsOfficeDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 transition flex items-start gap-2 hover:bg-blue-50/80 group ${
                                                            isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <Building2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {office.code && office.code !== 'NA' && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10px] border border-blue-200 shrink-0">
                                                                        ({office.code})
                                                                    </span>
                                                                )}
                                                                <span className="truncate">{office.name}</span>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <span className="text-blue-600 font-bold text-xs shrink-0">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                                        <span>{filteredOffices.length} office{filteredOffices.length === 1 ? '' : 's'} available</span>
                                        <span className="font-mono text-slate-400">(code)name</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CommentableCell>
                </div>

                <div className="mb-5">
                    <CommentableCell
                        as="div"
                        fieldKey="title"
                        fieldLabel="Project Title"
                        cellValue={title}
                        comments={visibleCellComments}
                        changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                        canComment={canComment}
                        canComply={canComply}
                        currentUser={user}
                        activeCellKey={activeHeaderCellKey}
                        setActiveCellKey={setActiveHeaderCellKey}
                        onAddCellComment={handleAddCellComment}
                        onDeleteCellComment={handleDeleteCellComment}
                        onComplyCellComment={handleComplyCellComment}
                        onUncomplyCellComment={handleUncomplyCellComment}
                        onUpdateCellValue={(newVal) => setTitle(newVal)}
                        className="p-1 rounded-md"
                    >
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Project Procurement Title / General Purpose: <span className="text-rose-600">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={title ?? ''}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder=""
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900"
                        />
                    </CommentableCell>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-4">

                    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 p-4 rounded-xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Truck className="w-4 h-4" />
                            </div>
                            <div>
                                <label htmlFor="additional-condition-select" className="block text-xs font-bold text-slate-800">
                                    Additional Condition / Standard Preset:
                                </label>
                                <p className="text-[11px] text-slate-500">
                                    Select pre-defined specifications for Catering Services, POL Condition, Water, Travelling, etc.
                                </p>
                            </div>
                        </div>

                        <div className="w-full md:w-80 shrink-0">
                            <select
                                id="additional-condition-select"
                                value={additionalCondition ?? ''}
                                onChange={(e) => handleConditionSelect(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            >
                                <option value="">-- Select Condition Preset (Optional) --</option>
                                {conditions.map((c) => (
                                    <option key={c.id} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">Delivery Period:</label>
                                {isPolCondition ? (
                                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        <Lock className="w-2.5 h-2.5" /> Locked (POL)
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">Dropdown / Custom</span>
                                )}
                            </div>
                            <select
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (findMatchingOption(deliveryPeriod, deliveryPeriodOptions, canonicalizeDeliveryPeriod) || (deliveryPeriod ? 'CUSTOM' : ''))}
                                onChange={(e) => {
                                    if (e.target.value !== 'CUSTOM') {
                                        setDeliveryPeriod(e.target.value);
                                    }
                                }}
                                className={`w-full text-xs p-2 mb-1.5 border rounded-md ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-50/70 border-slate-300 text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer'
                                    }`}
                            >
                                <option value="">{isPolCondition ? '-- Locked (Included in POL Terms) --' : '-- Choose Delivery Period --'}</option>
                                {!isPolCondition && deliveryPeriodOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>
                                        {opt.replace(/\n/g, ' ')}
                                    </option>
                                ))}
                                {!isPolCondition && <option value="CUSTOM">Custom / Other text...</option>}
                            </select>
                            <textarea
                                rows={2}
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (deliveryPeriod ?? '')}
                                onChange={(e) => setDeliveryPeriod(e.target.value)}
                                placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. 30 Calendar Days upon receipt of PO'}
                                className={`w-full text-xs p-2 border rounded-md resize-y ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                    }`}
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">Place of Delivery:</label>
                                {isPolCondition ? (
                                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        <Lock className="w-2.5 h-2.5" /> Locked (POL)
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">Dropdown / Custom</span>
                                )}
                            </div>
                            <select
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (findMatchingOption(placeOfDelivery, placeOfDeliveryOptions, canonicalizePlaceOfDelivery) || (placeOfDelivery ? 'CUSTOM' : ''))}
                                onChange={(e) => {
                                    if (e.target.value !== 'CUSTOM') {
                                        setPlaceOfDelivery(e.target.value);
                                    }
                                }}
                                className={`w-full text-xs p-2 mb-1.5 border rounded-md ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-50/70 border-slate-300 text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer'
                                    }`}
                            >
                                <option value="">{isPolCondition ? '-- Locked (Included in POL Terms) --' : '-- Choose Place of Delivery --'}</option>
                                {!isPolCondition && placeOfDeliveryOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                                {!isPolCondition && <option value="CUSTOM">Custom / Other text...</option>}
                            </select>
                            <input
                                type="text"
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (placeOfDelivery ?? '')}
                                onChange={(e) => setPlaceOfDelivery(e.target.value)}
                                placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. PGSO Warehouse - onsite'}
                                className={`w-full text-xs p-2 border rounded-md ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                    }`}
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">Payment Method:</label>
                                {isPolCondition ? (
                                    <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        <Lock className="w-2.5 h-2.5" /> Locked (POL)
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">Dropdown / Custom</span>
                                )}
                            </div>
                            <select
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (findMatchingOption(paymentMethod, paymentMethodOptions, canonicalizePaymentMethod) || (paymentMethod ? 'CUSTOM' : ''))}
                                onChange={(e) => {
                                    if (e.target.value !== 'CUSTOM') {
                                        setPaymentMethod(e.target.value);
                                    }
                                }}
                                className={`w-full text-xs p-2 mb-1.5 border rounded-md ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-50/70 border-slate-300 text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer'
                                    }`}
                            >
                                <option value="">{isPolCondition ? '-- Locked (Included in POL Terms) --' : '-- Choose Payment Method --'}</option>
                                {!isPolCondition && paymentMethodOptions.map((opt, idx) => (
                                    <option key={idx} value={opt}>
                                        {opt.length > 50 ? `${opt.slice(0, 50)}...` : opt}
                                    </option>
                                ))}
                                {!isPolCondition && <option value="CUSTOM">Custom / Other text...</option>}
                            </select>
                            <textarea
                                rows={2}
                                disabled={isPolCondition}
                                value={isPolCondition ? '' : (paymentMethod ?? '')}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. Staggered Delivery/Credit-basis'}
                                className={`w-full text-xs p-2 border rounded-md resize-y ${isPolCondition
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                    }`}
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-700">
                                    Other Terms: <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                                </label>
                                {isPolCondition ? (
                                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                        POL Condition Applied
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                                        <Leaf className="w-2.5 h-2.5 text-emerald-600" /> Green Specs / Custom
                                    </span>
                                )}
                            </div>
                            <GreenSpecDropdown
                                terms={otherTermsList}
                                selectedTermId={currentSelectedTermId}
                                currentText={warrantyAndOtherTerms}
                                onSelectTerm={(term) => {
                                    if (term.id === 'CUSTOM') {
                                        setSelectedOtherTermId('CUSTOM');
                                    } else {
                                        handleOtherTermSelect(term.id);
                                    }
                                }}
                                onAppendTerm={(term) => {
                                    handleAppendOtherTerm(term.id);
                                }}
                                onClear={() => {
                                    setSelectedOtherTermId('');
                                    setWarrantyAndOtherTerms('');
                                }}
                                isPolCondition={isPolCondition}
                            />
                            <textarea
                                rows={4}
                                value={warrantyAndOtherTerms ?? ''}
                                onChange={(e) => {
                                    setWarrantyAndOtherTerms(e.target.value);
                                    setSelectedOtherTermId('');
                                }}
                                placeholder="e.g. Green Specification, Contractual terms, or Supplier billing clauses..."
                                className={`w-full text-xs p-2 border rounded-md leading-snug resize-y ${isPolCondition
                                        ? 'border-blue-400 bg-blue-50/20 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none'
                                    }`}
                            />

                            {currentSelectedTermId && currentSelectedTermId !== 'CUSTOM' && warrantyAndOtherTerms && (
                                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                        <Leaf className="w-2.5 h-2.5" /> Spec loaded
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleAppendOtherTerm(currentSelectedTermId)}
                                        className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer text-[11px] hover:underline"
                                        title="Append another specification or add onto existing text"
                                    >
                                        + Append to existing text
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wide">
                        Procurement Plan Items & Schedule
                    </h3>
                    <span className="text-xs text-slate-500">
                        Total {items.length} item {items.length === 1 ? 'row' : 'rows'}
                    </span>
                </div>

                {canViewCellComments && visibleCellComments.length > 0 && (
                    <div className={`mb-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        pendingCellComments.length > 0
                            ? 'bg-red-50 border-red-300 text-red-900'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}>
                        <div className="flex items-center gap-2">
                            <span className={`p-1 rounded ${
                                pendingCellComments.length > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                <MessageSquare className="w-4 h-4" />
                            </span>
                            <div>
                                <span className="font-bold">Reviewer Cell Findings: </span>
                                <span>
                                    {pendingCellComments.length > 0
                                        ? `${pendingCellComments.length} finding${pendingCellComments.length > 1 ? 's' : ''} pending your compliance.`
                                        : 'All cell findings complied!'}
                                </span>
                                <span className="block text-[11px] text-slate-600 mt-0.5">
                                    {pendingCellComments.length > 0
                                        ? 'Click the 💬 badge or corner indicator on any cell to view reviewer comments and click "Mark Complied" once corrected.'
                                        : 'All reviewer findings have been addressed and marked as complied.'}
                                </span>
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            pendingCellComments.length > 0
                                ? 'bg-red-200 text-red-900 border border-red-400'
                                : 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                        }`}>
                            {pendingCellComments.length > 0 ? `${pendingCellComments.length} PENDING` : 'ALL COMPLIED ✓'}
                        </span>
                    </div>
                )}

                <ProcurementPlanTable
                    items={items}
                    isEditable={true}
                    fiscalYear={fiscalYear}
                    workflowRoute={workflowRoute}
                    onAddItem={handleAddItem}
                    onAddRetention={handleAddRetention}
                    onRemoveItem={handleRemoveItem}
                    onUpdateItem={handleUpdateItem}
                    totalBudget={totalBudget}
                    accountCode={accountCode}
                    onAccountCodeChange={setAccountCode}
                    accountCodeId={accountCodeId}
                    onAccountCodeIdChange={setAccountCodeId}
                    programName={programName}
                    onProgramNameChange={setProgramName}
                    programNameId={programNameId}
                    onProgramNameIdChange={setProgramNameId}
                    supportingDocuments={supportingDocsList}
                    procurementModes={procurementModesList}
                    cellComments={visibleCellComments}
                    changeLogs={initialPpmp?.change_logs || initialPpmp?.changeLogs || []}
                    canComment={canComment}
                    canComply={canComply}
                    currentUser={user}
                    onAddCellComment={handleAddCellComment}
                    onDeleteCellComment={handleDeleteCellComment}
                    onComplyCellComment={handleComplyCellComment}
                    onUncomplyCellComment={handleUncomplyCellComment}
                />
            </div>
        </form>
    );
};
