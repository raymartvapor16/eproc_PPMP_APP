import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { Printer, ArrowLeft, Plus, Trash2, Edit3, Loader2, Sparkles, ShieldCheck, Truck, Lock, Leaf, CheckCircle2, ChevronRight, ChevronLeft, Eye, Layers, Copy, Check, Save, AlertTriangle } from 'lucide-react';
import { ppmpService, procurementConditionService, otherTermService } from '../../services/api';
import { GreenSpecDropdown } from './GreenSpecDropdown';
import { useSignatureSettings } from '../../utils/signatureController';
import {
    BASE_DELIVERY_PERIODS,
    BASE_PLACES_OF_DELIVERY,
    BASE_PAYMENT_METHODS,
    canonicalizeDeliveryPeriod,
    canonicalizePlaceOfDelivery,
    canonicalizePaymentMethod,
    deduplicateOptions,
    findMatchingOption,
    isDateScheduleString,
} from '../../utils/procurementOptions';

export const POL_TERMS_TEXT = `POL Condition:
-Staggered Delivery based on the latest fuel pump price /At Gasoline Station
-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.
-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings and will resume only after the outstanding obligations are settled.`;

/**
 * Builds initial attachment list records for all procurement rows.
 * Handles both single-item and multiple-item PPMPs, and merges saved data seamlessly.
 */
export const getInitialAttachmentLists = (ppmp, procurementItems, savedData) => {
    const rawFundSource = ppmp?.items?.find(i => !i.is_header && i.source_of_fund)?.source_of_fund?.trim() || 'General Fund';
    const fiscalYearStr = ppmp?.fiscal_year ? `CY ${ppmp.fiscal_year}` : '';
    const accountCodeStr = ppmp?.account_code || '';

    const savedLists = savedData?.attachment_lists || {};

    return procurementItems.map((item, idx) => {
        const itemKey = String(item.id !== undefined && item.id !== null ? item.id : idx);
        const itemSaved = savedLists[itemKey] || savedLists[String(idx)] || savedLists[idx] || (idx === 0 && savedData?.rows ? savedData : null);

        const itemAccountCode = item.account_code || accountCodeStr;
        const itemFund = item.source_of_fund?.trim() || rawFundSource;
        let itemFundStr = itemFund;
        if (fiscalYearStr && !itemFund.toLowerCase().includes(fiscalYearStr.toLowerCase())) {
            itemFundStr = `${fiscalYearStr} ${itemFund}`.trim();
        }
        const defaultItemCharges = itemAccountCode && itemFundStr
            ? `${itemAccountCode} / ${itemFundStr}`
            : (itemAccountCode || itemFundStr || '');

        // Resolve contractual delivery period specification from PPMP or saved attachment list.
        // Never fall back to item.delivery_period which holds the monthly schedule date (e.g. "10/2026").
        let resolvedDeliveryPeriod = ppmp?.delivery_period || '30 Calendar Days upon receipt of PO';
        const savedDeliveryPeriod = itemSaved?.delivery_period;
        if (savedDeliveryPeriod && !isDateScheduleString(savedDeliveryPeriod) && savedDeliveryPeriod !== item.delivery_period) {
            resolvedDeliveryPeriod = savedDeliveryPeriod;
        } else if (ppmp?.delivery_period && !isDateScheduleString(ppmp.delivery_period)) {
            resolvedDeliveryPeriod = ppmp.delivery_period;
        }

        const ppmpAllocatedBudget = (item.estimated_budget !== undefined && item.estimated_budget !== null && item.estimated_budget !== '')
            ? parseFloat(item.estimated_budget) || 0
            : (procurementItems.length === 1 && ppmp?.total_budget ? parseFloat(ppmp.total_budget) || 0 : (parseFloat(ppmp?.total_budget) || 0));

        return {
            itemId: item.id !== undefined && item.id !== null ? item.id : idx,
            itemKey,
            itemNo: item.item_no || idx + 1,
            sourceDescription: item.description || '',
            ppmpAllocatedBudget,
            officeName: itemSaved?.office_name || savedData?.office_name || ppmp?.implementing_unit || ppmp?.office?.name || 'Provincial Government of Davao del Sur',
            projectTitle: itemSaved?.project_title || item.description || ppmp?.title || '',
            totalBudget: ppmpAllocatedBudget > 0
                ? (itemSaved?.total_budget !== undefined && itemSaved?.total_budget !== null && itemSaved?.total_budget !== ''
                    ? Math.min(parseFloat(itemSaved.total_budget) || 0, ppmpAllocatedBudget)
                    : ppmpAllocatedBudget)
                : (parseFloat(itemSaved?.total_budget) || 0),
            charges: itemSaved?.charges || defaultItemCharges,
            placeOfDelivery: itemSaved?.place_of_delivery || ppmp?.place_of_delivery || 'PGSO Warehouse/On-site',
            paymentMethod: itemSaved?.payment_method || ppmp?.payment_method || 'Staggered Delivery/Credit-basis',
            deliveryPeriod: resolvedDeliveryPeriod,
            additionalCondition: itemSaved?.additional_condition || ppmp?.additional_condition || '',
            otherTerms: itemSaved?.other_terms || ppmp?.warranty_and_other_terms || '',
            selectedOtherTermId: '',
            rows: (itemSaved?.rows && Array.isArray(itemSaved.rows) && itemSaved.rows.length > 0)
                ? itemSaved.rows.map(r => ({
                    id: r.id || 1,
                    itemNo: r.itemNo || 1,
                    unit: r.unit || '',
                    description: r.description || '',
                    qty: (r.qty !== null && r.qty !== undefined) ? r.qty : '',
                    unitCost: (r.unitCost !== null && r.unitCost !== undefined) ? r.unitCost : '',
                    totalCost: (r.totalCost !== null && r.totalCost !== undefined) ? r.totalCost : '',
                }))
                : [
                    { id: 1, itemNo: 1, unit: '', description: '', qty: '', unitCost: '', totalCost: '' }
                ],
        };
    });
};

/**
 * PPMPAttachmentListView:
 * Create & View flow for "PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) LIST".
 * Supports single-item and multiple-item PPMPs (generating 1 Attachment List per procurement row).
 */
export const PPMPAttachmentListView = ({ ppmp, user, canEdit = true, initialItemId = null, onBack, onGenerated }) => {
    const savedData = ppmp?.attachment_list_data || null;

    // Filter actual procurement items (excluding account code header rows)
    const procurementItems = useMemo(() => {
        const raw = (ppmp?.items || []).filter(item => !item.is_header && item.description && item.description.trim() !== '');
        if (raw.length > 0) return raw;
        return [
            {
                id: 'default',
                item_no: 1,
                description: ppmp?.title || 'General Procurement Project',
                estimated_budget: ppmp?.total_budget ? parseFloat(ppmp.total_budget) : 0,
                source_of_fund: ppmp?.source_of_fund || 'General Fund',
                delivery_period: ppmp?.delivery_period || '',
            }
        ];
    }, [ppmp]);

    // Permissions
    const isCreator = ppmp?.created_by === user?.id;
    const isCreatorEditable = isCreator && [
        'DRAFT',
        'HEAD_PENDING',
        'HEAD_APPROVED',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'OPPMO_RETURNED',
        'TWG_RETURNED'
    ].includes(ppmp?.status);

    const isReviewerEditable = (
        (user?.role === 'head' && ['HEAD_PENDING', 'HEAD_APPROVED'].includes(ppmp?.status) && user?.office_id === ppmp?.office_id) ||
        (user?.role === 'budget_officer' && ppmp?.status === 'BUDGET_OFFICER_REVIEW') ||
        (user?.role === 'oppmo' && ppmp?.status === 'OPPMO_REVIEW') ||
        (user?.role === 'twg' && ppmp?.status === 'TWG_REVIEW')
    );

    const isScopeLocked = ppmp?.amendment_scope === 'PPMP_APP' && !['admin', 'super_admin'].includes(user?.role);
    const allowEdit = canEdit && !isScopeLocked && (isCreatorEditable || isReviewerEditable || ['admin', 'super_admin'].includes(user?.role));

    // Multi-attachment list state
    const [attachmentLists, setAttachmentLists] = useState(() => {
        return getInitialAttachmentLists(ppmp, procurementItems, savedData);
    });

    // Active item index
    const [activeItemIndex, setActiveItemIndex] = useState(() => {
        if (initialItemId !== null && initialItemId !== undefined) {
            const foundIdx = procurementItems.findIndex(i => String(i.id) === String(initialItemId));
            if (foundIdx >= 0) return foundIdx;
        }
        return 0;
    });

    // Sync activeItemIndex when parent updates initialItemId
    useEffect(() => {
        if (initialItemId !== null && initialItemId !== undefined) {
            const foundIdx = procurementItems.findIndex(i => String(i.id) === String(initialItemId));
            if (foundIdx >= 0) {
                setActiveItemIndex(foundIdx);
            }
        }
    }, [initialItemId, procurementItems]);

    // Sync with savedData if ppmp updates from server
    useEffect(() => {
        if (savedData && !isEditing) {
            setAttachmentLists(getInitialAttachmentLists(ppmp, procurementItems, savedData));
        }
    }, [ppmp, savedData]);

    // Mode: editing vs official print view
    const [isEditing, setIsEditing] = useState(!savedData && allowEdit);
    const [viewAllMode, setViewAllMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [printScope, setPrintScope] = useState('all'); // 'all' or 'current'
    const [pendingPrint, setPendingPrint] = useState(false);
    const [copiedAllFeedback, setCopiedAllFeedback] = useState(false);

    // Auto-trigger window.print() after state updates for printScope / viewAllMode
    useEffect(() => {
        if (pendingPrint) {
            const timer = setTimeout(() => {
                setPendingPrint(false);
                window.print();
            }, 180);
            return () => clearTimeout(timer);
        }
    }, [pendingPrint]);

    // Active list being edited
    const activeList = attachmentLists[activeItemIndex] || attachmentLists[0];

    // Presets from server
    const [conditions, setConditions] = useState([]);
    const [otherTermsList, setOtherTermsList] = useState([]);

    useEffect(() => {
        let isMounted = true;
        const loadPresets = async () => {
            try {
                const [condRes, termsRes] = await Promise.all([
                    procurementConditionService.getAll({ active_only: 1, with_options: 1 }),
                    otherTermService.getAll({ active_only: 1 }),
                ]);
                if (isMounted) {
                    if (condRes.data?.conditions) {
                        setConditions(condRes.data.conditions);
                    } else if (Array.isArray(condRes.data)) {
                        setConditions(condRes.data);
                    }
                    setOtherTermsList(Array.isArray(termsRes.data) ? termsRes.data : []);
                }
            } catch (err) {
                console.error('Failed to load conditions or green specs in Attachment List', err);
            }
        };
        loadPresets();
        return () => { isMounted = false; };
    }, []);

    // Sync delivery period preset if condition was selected on PPMP but was not yet saved or defaulted
    useEffect(() => {
        if (conditions.length > 0) {
            setAttachmentLists(prev => prev.map(list => {
                if (list.additionalCondition && (!list.deliveryPeriod || list.deliveryPeriod === '30 Calendar Days upon receipt of PO' || isDateScheduleString(list.deliveryPeriod))) {
                    const matchedCond = conditions.find(c => c.name === list.additionalCondition);
                    if (matchedCond?.delivery_period) {
                        return {
                            ...list,
                            deliveryPeriod: matchedCond.delivery_period,
                            placeOfDelivery: list.placeOfDelivery || matchedCond.place_of_delivery || 'PGSO Warehouse/On-site',
                            paymentMethod: list.paymentMethod || matchedCond.payment_method || 'Staggered Delivery/Credit-basis',
                        };
                    }
                }
                return list;
            }));
        }
    }, [conditions]);

    // Dropdown options
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

    // Signatories & Electronic Signature Controller
    const { isEnabled } = useSignatureSettings();
    const isAttachmentSignatureEnabled = ppmp?.signature_settings?.attachment_list !== undefined
        ? Boolean(ppmp.signature_settings.attachment_list)
        : isEnabled('attachment_list');

    const isAttachmentAmended = ppmp?.amendment_scope === 'ATTACHMENT_LIST' || ppmp?.amendment_scope === 'ALL';
    const isScopePpmpAppOnly = ppmp?.amendment_scope === 'PPMP_APP';

    const preparedSig = ppmp?.signatures?.find(s => s.role === 'end_user')
        || ppmp?.parent?.signatures?.find(s => s.role === 'end_user')
        || null;

    const hasHeadApproved = Boolean(
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
    );
    const headSig = hasHeadApproved
        ? (ppmp?.signatures?.find(s => s.role === 'head') || (isScopePpmpAppOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'head') : null))
        : null;

    const hasTwgApprovedChild = Boolean(
        ppmp?.twg_approved_at ||
        (['HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status) && ppmp?.signatures?.some(s => s.role === 'twg'))
    );

    const twgSig = isAttachmentAmended
        ? (hasTwgApprovedChild ? ppmp?.signatures?.find(s => s.role === 'twg') : null)
        : (ppmp?.signatures?.find(s => s.role === 'twg') || (isScopePpmpAppOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'twg') : null));

    const resolvedOfficeHeadName = ppmp?.office?.head_name || ppmp?.office?.head?.name || '';
    const resolvedOfficeHeadPosition = ppmp?.office?.designation || ppmp?.office?.head?.designation || 'Head of Office';

    const [endUserName, setEndUserName] = useState(
        (savedData?.prepared_by_name && savedData.prepared_by_name !== 'NAME OF END USER')
            ? savedData.prepared_by_name
            : (preparedSig?.signer_name || ppmp?.creator?.name || 'NAME OF END USER')
    );
    const [endUserPosition, setEndUserPosition] = useState(
        (savedData?.prepared_by_position && savedData.prepared_by_position !== 'Project In-Charge')
            ? savedData.prepared_by_position
            : (preparedSig?.signer_designation || ppmp?.creator?.designation || 'Project In-Charge')
    );

    const [headName, setHeadName] = useState(
        (savedData?.submitted_by_name && savedData.submitted_by_name !== 'NAME OF HEAD')
            ? savedData.submitted_by_name
            : (headSig?.signer_name || resolvedOfficeHeadName || 'NAME OF HEAD')
    );
    const [headPosition, setHeadPosition] = useState(
        (savedData?.submitted_by_position && savedData.submitted_by_position !== 'Head of Office')
            ? savedData.submitted_by_position
            : (headSig?.signer_designation || resolvedOfficeHeadPosition || 'Head of Office')
    );

    const [approvedByName, setApprovedByName] = useState(
        savedData?.approved_by_name || ppmp?.default_signatories?.approved_by?.name || 'HON. YVONNE R. CAGAS'
    );
    const [approvedByPosition, setApprovedByPosition] = useState(
        savedData?.approved_by_position || ppmp?.default_signatories?.approved_by?.position || 'PROVINCIAL GOVERNOR'
    );

    // Helpers to update active list
    const updateActiveField = (field, value) => {
        setAttachmentLists(prev => {
            const next = [...prev];
            next[activeItemIndex] = {
                ...next[activeItemIndex],
                [field]: value
            };
            return next;
        });
    };

    const updateActiveFields = (fieldsObj) => {
        setAttachmentLists(prev => {
            const next = [...prev];
            next[activeItemIndex] = {
                ...next[activeItemIndex],
                ...fieldsObj
            };
            return next;
        });
    };

    // Helper to copy office, charges, delivery & terms from current active list to all other lists
    const handleCopySettingsToAll = () => {
        setAttachmentLists(prev => {
            return prev.map(list => ({
                ...list,
                officeName: activeList.officeName,
                charges: activeList.charges,
                placeOfDelivery: activeList.placeOfDelivery,
                paymentMethod: activeList.paymentMethod,
                deliveryPeriod: activeList.deliveryPeriod,
                additionalCondition: activeList.additionalCondition,
                otherTerms: activeList.otherTerms,
            }));
        });
        setCopiedAllFeedback(true);
        setTimeout(() => setCopiedAllFeedback(false), 2500);
    };

    const handleUpdateRow = (rowIndex, field, value) => {
        setAttachmentLists(prev => {
            const next = [...prev];
            const currentRows = [...next[activeItemIndex].rows];
            currentRows[rowIndex] = { ...currentRows[rowIndex], [field]: value };

            if (field === 'qty' || field === 'unitCost') {
                const qVal = field === 'qty' ? value : currentRows[rowIndex].qty;
                const costVal = field === 'unitCost' ? value : currentRows[rowIndex].unitCost;

                if (qVal === '' || costVal === '' || qVal === null || costVal === null) {
                    currentRows[rowIndex].totalCost = '';
                } else {
                    const q = parseFloat(qVal);
                    const cost = parseFloat(costVal);
                    if (!isNaN(q) && !isNaN(cost) && q >= 0 && cost >= 0) {
                        currentRows[rowIndex].totalCost = Math.round(q * cost * 100) / 100;
                    } else {
                        currentRows[rowIndex].totalCost = '';
                    }
                }
            }

            next[activeItemIndex] = {
                ...next[activeItemIndex],
                rows: currentRows
            };
            return next;
        });
    };

    const handleAddRow = () => {
        setAttachmentLists(prev => {
            const next = [...prev];
            const currentRows = [...next[activeItemIndex].rows];
            const newId = currentRows.length > 0 ? Math.max(...currentRows.map(r => r.id || 0)) + 1 : 1;
            currentRows.push({
                id: newId,
                itemNo: currentRows.length + 1,
                unit: '',
                description: '',
                qty: '',
                unitCost: '',
                totalCost: ''
            });
            next[activeItemIndex] = {
                ...next[activeItemIndex],
                rows: currentRows
            };
            return next;
        });
    };

    const handleRemoveRow = (rowIndex) => {
        setAttachmentLists(prev => {
            const next = [...prev];
            const currentRows = [...next[activeItemIndex].rows];
            if (currentRows.length <= 1) {
                alert('At least one item row is required in the PPMP list.');
                return prev;
            }
            const filtered = currentRows.filter((_, idx) => idx !== rowIndex).map((r, i) => ({ ...r, itemNo: i + 1 }));
            next[activeItemIndex] = {
                ...next[activeItemIndex],
                rows: filtered
            };
            return next;
        });
    };

    const isPolCondition = activeList.additionalCondition === 'POL Condition';

    const handleConditionSelect = (conditionName) => {
        if (!conditionName) {
            updateActiveFields({
                additionalCondition: '',
                otherTerms: activeList.otherTerms === POL_TERMS_TEXT ? '' : activeList.otherTerms,
            });
            return;
        }

        const found = conditions.find((c) => c.name === conditionName);

        if (conditionName === 'POL Condition') {
            const polText = found?.other_terms || POL_TERMS_TEXT;
            updateActiveFields({
                additionalCondition: 'POL Condition',
                otherTerms: polText,
                deliveryPeriod: '',
                placeOfDelivery: '',
                paymentMethod: '',
            });
            return;
        }

        if (found) {
            updateActiveFields({
                additionalCondition: conditionName,
                placeOfDelivery: found.place_of_delivery || activeList.placeOfDelivery,
                deliveryPeriod: found.delivery_period || activeList.deliveryPeriod,
                paymentMethod: found.payment_method || activeList.paymentMethod,
                otherTerms: activeList.otherTerms === POL_TERMS_TEXT ? '' : activeList.otherTerms,
            });
        } else {
            updateActiveField('additionalCondition', conditionName);
        }
    };

    const handleOtherTermSelect = (termId) => {
        updateActiveField('selectedOtherTermId', termId);
        if (!termId || termId === 'CUSTOM') return;
        const found = otherTermsList.find((t) => String(t.id) === String(termId));
        if (found && found.description) {
            updateActiveField('otherTerms', found.description);
        }
    };

    const handleAppendOtherTerm = (termId) => {
        if (!termId || termId === 'CUSTOM') return;
        const found = otherTermsList.find((t) => String(t.id) === String(termId));
        if (found && found.description) {
            const prev = activeList.otherTerms || '';
            const nextVal = (!prev || !prev.trim()) ? found.description : `${prev.trim()}\n\n${found.description}`;
            updateActiveField('otherTerms', nextVal);
        }
    };

    const currentSelectedTermId = useMemo(() => {
        if (activeList.selectedOtherTermId) return activeList.selectedOtherTermId;
        if (!activeList.otherTerms) return '';
        const match = otherTermsList.find((t) => t.description.trim() === activeList.otherTerms.trim());
        return match ? String(match.id) : 'CUSTOM';
    }, [activeList.selectedOtherTermId, activeList.otherTerms, otherTermsList]);

    // Save Single Attachment
    const handleGenerate = async () => {
        // Validate active attachment list has at least some item description or quantity
        const activeHasContent = activeList.rows && activeList.rows.some(r => (r.description && r.description.trim() !== '') || (r.qty && r.qty !== ''));
        if (!activeHasContent) {
            alert('Please add at least one item description or specification to this attachment list before saving.');
            return;
        }

        // Validate that no attachment list exceeds the PPMP allocated budget
        for (const list of attachmentLists) {
            const listTotal = (list.rows || []).reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
            const listBudget = parseFloat(list.ppmpAllocatedBudget !== undefined ? list.ppmpAllocatedBudget : list.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);

            if (listBudget > 0 && listTotal > (listBudget + 0.01)) {
                alert(`Cannot save: The Total Cost (${formatCurrency(listTotal)}) of "${list.projectTitle || `Item #${list.itemNo}`}" exceeds the Allocated Budget (${formatCurrency(listBudget)}) from the PPMP data by ${formatCurrency(listTotal - listBudget)}.\n\nThe Total Cost of the PPMP List of Attachment must coincide with or be lower than the Allocated Budget.`);
                return;
            }
        }

        const allListsMap = {
            ...(savedData?.attachment_lists || {}),
        };
        attachmentLists.forEach(list => {
            allListsMap[list.itemKey] = {
                office_name: list.officeName,
                project_title: list.projectTitle,
                total_budget: parseFloat(list.totalBudget) || 0,
                charges: list.charges,
                place_of_delivery: list.placeOfDelivery,
                payment_method: list.paymentMethod,
                delivery_period: list.deliveryPeriod,
                additional_condition: list.additionalCondition,
                other_terms: list.otherTerms,
                rows: list.rows,
            };
        });

        const activePayload = {
            office_name: activeList.officeName,
            project_title: activeList.projectTitle,
            total_budget: parseFloat(activeList.totalBudget) || 0,
            charges: activeList.charges,
            place_of_delivery: activeList.placeOfDelivery,
            payment_method: activeList.paymentMethod,
            delivery_period: activeList.deliveryPeriod,
            additional_condition: activeList.additionalCondition,
            other_terms: activeList.otherTerms,
            rows: activeList.rows,
            prepared_by_name: endUserName,
            prepared_by_position: endUserPosition,
            submitted_by_name: headName,
            submitted_by_position: headPosition,
            approved_by_name: approvedByName,
            approved_by_position: approvedByPosition,
            attachment_lists: allListsMap,
            active_item_id: activeList.itemId,
        };

        setSaving(true);
        try {
            if (ppmp?.uuid) {
                const response = await ppmpService.saveAttachmentList(ppmp.uuid, activePayload);
                localStorage.setItem(`ppmp_attachment_${ppmp.uuid}`, JSON.stringify(activeList.rows));
                localStorage.setItem(`ppmp_attachment_generated_${ppmp.uuid}`, 'true');

                setIsEditing(false);
                if (onGenerated) {
                    onGenerated(response.data?.ppmp || null);
                }
            } else {
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Failed to save PPMP List of Attachment', error);
            alert(error.response?.data?.message || 'Failed to save PPMP Attachment List to server. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Printing
    const isParentApproved = ppmp?.amendment_scope === 'PPMP_APP' && ppmp?.parent?.status === 'READY_TO_PRINT';
    const isReadyToPrint = ppmp?.status === 'READY_TO_PRINT' || isParentApproved || ['admin', 'super_admin'].includes(user?.role);

    // Print all attachment lists sequentially
    const handlePrintAll = () => {
        if (!isReadyToPrint) {
            alert('Printing is only authorized once the PPMP has reached the READY TO PRINT status after full workflow approval.');
            return;
        }
        setPrintScope('all');
        setViewAllMode(true);
        setPendingPrint(true);
    };

    // Print only the active attachment list
    const handlePrintCurrent = () => {
        if (!isReadyToPrint) {
            alert('Printing is only authorized once the PPMP has reached the READY TO PRINT status after full workflow approval.');
            return;
        }
        setPrintScope('current');
        setPendingPrint(true);
    };

    // Calculate totals and PPMP allocated budget for active list
    const activePpmpBudget = parseFloat(activeList.ppmpAllocatedBudget !== undefined ? activeList.ppmpAllocatedBudget : activeList.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);
    const activeCalculatedTotal = activeList.rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
    const activeDisplayTotalBudget = activeCalculatedTotal > 0 ? activeCalculatedTotal : (parseFloat(activeList.totalBudget) || activePpmpBudget);
    const isActiveOverBudget = activePpmpBudget > 0 && activeCalculatedTotal > (activePpmpBudget + 0.01);
    const activeBudgetExcess = isActiveOverBudget ? activeCalculatedTotal - activePpmpBudget : 0;
    const activeBudgetRemaining = activePpmpBudget > activeCalculatedTotal ? activePpmpBudget - activeCalculatedTotal : 0;
    const isCoinciding = activePpmpBudget > 0 && Math.abs(activePpmpBudget - activeCalculatedTotal) <= 0.01;

    // Render single official printable attachment sheet
    const renderPrintSheet = (list, listIdx) => {
        const itemCalculatedTotal = list.rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
        const itemDisplayTotalBudget = itemCalculatedTotal > 0 ? itemCalculatedTotal : (parseFloat(list.totalBudget) || 0);
        const viewRows = list.rows.filter(r => (r.unit || r.description || r.qty || r.unitCost || r.totalCost));
        const listIsPol = list.additionalCondition === 'POL Condition';

        return (
            <div
                key={list.itemKey || listIdx}
                className={`attachment-sheet p-8 sm:p-12 w-full max-w-[820px] mx-auto bg-white text-black shadow-xl rounded-2xl print:p-0 print:max-w-none print:shadow-none print:rounded-none border border-slate-200 print:border-none ${
                    listIdx > 0 ? 'mt-8 print:mt-0 print:break-before-page' : ''
                }`}
                style={listIdx > 0 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}
            >
                {/* Multi-list indicator in print preview */}
                {attachmentLists.length > 1 && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-2 pb-1 border-b border-slate-200 print:border-black/20">
                        <span className="font-bold uppercase text-slate-700 print:text-black">
                            Attachment List {listIdx + 1} of {attachmentLists.length}
                        </span>
                        <span className="text-slate-500">
                            Procurement Row #{list.itemNo}: {list.sourceDescription.slice(0, 45)}...
                        </span>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-center gap-4 mb-4 text-center relative">
                    <img
                        src="/images/logo.png"
                        alt="Provincial Seal"
                        className="w-16 h-16 object-contain absolute left-4 top-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                        <div className="text-sm sm:text-base font-bold uppercase tracking-tight">
                            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP ) CY {ppmp?.fiscal_year || new Date().getFullYear()}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold tracking-tight mt-0.5">
                            Provincial Government of Davao del Sur
                        </div>
                        <div className="text-xs sm:text-sm font-normal tracking-tight">
                            Matti, Digos City
                        </div>
                    </div>
                </div>

                {/* Metadata details */}
                <div className="text-xs font-bold space-y-1 mb-3 pt-2">
                    <div>
                        End User/ Implementing Unit: <span className="font-semibold uppercase">{list.officeName}</span>
                    </div>
                    <div>
                        Program/Project Title: <span className="font-semibold uppercase">{list.projectTitle || '—'}</span>
                    </div>
                    <div>Charges: {list.charges || '—'}</div>
                </div>

                {/* Main Table */}
                <table className="w-full border-collapse border border-black text-[11px]">
                    <thead>
                        <tr className="border border-black font-bold text-center bg-slate-50">
                            <th className="border border-black px-2 py-1.5 w-14">Item No.</th>
                            <th className="border border-black px-2 py-1.5 w-24">Unit</th>
                            <th className="border border-black px-3 py-1.5 text-left">Item and Description</th>
                            <th className="border border-black px-2 py-1.5 w-16">Qty</th>
                            <th className="border border-black px-2 py-1.5 w-24">Unit Cost</th>
                            <th className="border border-black px-2 py-1.5 w-28">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {viewRows.map((row, idx) => (
                            <tr key={idx} className="h-7 border border-black">
                                <td className="border border-black text-center px-1 py-1 font-mono">
                                    {row.itemNo}
                                </td>
                                <td className="border border-black text-center px-1 py-1 text-slate-700">
                                    {row.unit}
                                </td>
                                <td className="border border-black px-2 py-1 font-medium">
                                    {row.description}
                                </td>
                                <td className="border border-black text-center px-1 py-1 font-mono">
                                    {row.qty}
                                </td>
                                <td className="border border-black text-right px-2 py-1 font-mono">
                                    {row.unitCost ? formatCurrency(row.unitCost) : ''}
                                </td>
                                <td className="border border-black text-right px-2 py-1 font-mono">
                                    {row.totalCost !== null && row.totalCost !== undefined && row.totalCost !== '' ? formatCurrency(row.totalCost) : ''}
                                </td>
                            </tr>
                        ))}

                        {/* Charges & Delivery Info Row */}
                        <tr className="border border-black">
                            <td colSpan={2} className="border border-black"></td>
                            <td className="border border-black p-2 font-bold space-y-1.5 text-[11px] align-top">
                                {list.otherTerms ? (
                                    <div className="mb-1.5 pb-1 border-b border-dashed border-black/30 font-normal whitespace-pre-wrap">
                                        {list.otherTerms}
                                    </div>
                                ) : null}

                                {!listIsPol && list.placeOfDelivery ? (
                                    <div className="mt-1">
                                        Place of Delivery: <span className="font-normal">{list.placeOfDelivery}</span>
                                    </div>
                                ) : null}
                                {!listIsPol && list.paymentMethod ? (
                                    <div>
                                        Payment Method: <span className="font-normal">{list.paymentMethod}</span>
                                    </div>
                                ) : null}
                                {!listIsPol && list.deliveryPeriod ? (
                                    <div>
                                        Delivery Period: <span className="font-normal">{list.deliveryPeriod}</span>
                                    </div>
                                ) : null}
                            </td>
                            <td colSpan={2} className="border border-black p-2 text-right font-extrabold uppercase align-top">
                                TOTAL
                            </td>
                            <td className="border border-black p-2 text-right font-mono font-bold align-top">
                                {formatCurrency(itemCalculatedTotal > 0 ? itemCalculatedTotal : itemDisplayTotalBudget)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Signatures Section */}
                <div className="mt-4 text-xs bg-white print-signature-box">
                    <div className="grid grid-cols-2 gap-6 mb-3">
                        <div>
                            <div className="font-bold text-[10px] mb-1">Prepared By:</div>
                            <div className="text-center flex flex-col items-center justify-end">
                                {isAttachmentSignatureEnabled && preparedSig?.user?.signature_path ? (
                                    <div className="h-8 flex items-center justify-center">
                                        <img
                                            src={`/api/users/${preparedSig.user.id}/signature`}
                                            alt="Signature"
                                            className="max-h-8 max-w-[120px] object-contain"
                                        />
                                    </div>
                                ) : (isAttachmentSignatureEnabled && preparedSig?.signature_indicator) ? (
                                    <div className="inline-flex flex-col items-center mb-1">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[10px] font-mono">
                                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                            <span>{preparedSig.signature_indicator}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-2" />
                                )}
                                <div className="font-bold text-xs uppercase underline">
                                    {endUserName}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                    {endUserPosition}
                                </div>
                                {isAttachmentSignatureEnabled && preparedSig?.signed_at && (
                                    <div className="text-[9px] text-slate-500">
                                        Date/Time: {formatDate(preparedSig.signed_at)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="font-bold text-[10px] mb-1">Submitted By:</div>
                            <div className="text-center flex flex-col items-center justify-end">
                                {isAttachmentSignatureEnabled && headSig?.user?.signature_path ? (
                                    <div className="h-8 flex items-center justify-center">
                                        <img
                                            src={`/api/users/${headSig.user.id}/signature`}
                                            alt="Signature"
                                            className="max-h-8 max-w-[120px] object-contain"
                                        />
                                    </div>
                                ) : (isAttachmentSignatureEnabled && headSig?.signature_indicator) ? (
                                    <div className="inline-flex flex-col items-center mb-1">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-300 rounded text-blue-800 text-[10px] font-mono">
                                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                                            <span>{headSig.signature_indicator}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-2" />
                                )}
                                <div className="font-bold text-xs uppercase underline">
                                    {headName && headName !== 'NAME OF HEAD' ? headName : (resolvedOfficeHeadName || 'NAME OF HEAD')}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                    {headPosition && headPosition !== 'Head of Office' ? headPosition : (resolvedOfficeHeadPosition || 'Head of Office')}
                                </div>
                                {isAttachmentSignatureEnabled && headSig?.signed_at && (
                                    <div className="text-[9px] text-slate-500">
                                        Date/Time: {formatDate(headSig.signed_at)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="text-center flex flex-col items-center justify-end">
                            <div className="font-bold text-[10px] uppercase mb-1">REVIEWED BY TWG:</div>
                            {isAttachmentSignatureEnabled && twgSig?.user?.signature_path ? (
                                <div className="h-8 flex items-center justify-center">
                                    <img
                                        src={`/api/users/${twgSig.user.id}/signature`}
                                        alt="Signature"
                                        className="max-h-8 max-w-[120px] object-contain"
                                    />
                                </div>
                            ) : (isAttachmentSignatureEnabled && twgSig?.signature_indicator) ? (
                                <div className="inline-flex flex-col items-center mb-1">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 border border-cyan-300 rounded text-cyan-800 text-[10px] font-mono">
                                        <ShieldCheck className="w-3 h-3 text-cyan-600" />
                                        <span>{twgSig.signature_indicator}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-2" />
                            )}
                            <div className="font-bold text-xs uppercase underline">
                                {twgSig?.signer_name || twgSig?.user?.name || 'NAME OF TWG INCHARGE'}
                            </div>
                            <div className="text-[10px] text-slate-600">
                                {twgSig?.signer_designation || twgSig?.user?.designation || 'BAC TWG'}
                            </div>
                            {isAttachmentSignatureEnabled && twgSig?.signed_at && (
                                <div className="text-[9px] text-slate-500">
                                    Date/Time: {formatDate(twgSig.signed_at)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Generated / E-Signature Validity Notice */}
                    {isAttachmentSignatureEnabled && (
                        <div className="mt-4 pt-2 border-t border-dotted border-slate-300 text-center">
                            <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                                * This is an electronically generated and certified document under the Electronic Procurement Management System. Valid even without a physical or handwritten signature.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-100 min-h-screen font-sans text-slate-800">
            {/* Scoped Portrait Print Stylesheet for PPMP Attachment List */}
            <style>{`
                @media print {
                    @page {
                        size: portrait !important;
                        margin: 10mm 12mm !important;
                    }
                    html, body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print,
                    .no-print * {
                        display: none !important;
                    }
                    .attachment-sheet {
                        page-break-after: always !important;
                        break-after: page !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .attachment-sheet:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .print-signature-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* Top Navigation / Action Bar */}
            <div className="no-print bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer text-slate-200 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to PPMP Details
                    </button>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) LIST
                            {attachmentLists.length > 1 && (
                                <span className="text-[10px] bg-blue-600 text-white font-mono px-2 py-0.5 rounded-full">
                                    {attachmentLists.length} Lists
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                            {isEditing
                                ? `Data Entry — Editing Attachment ${activeItemIndex + 1} of ${attachmentLists.length}`
                                : (viewAllMode ? `Official Attachment View — Viewing All ${attachmentLists.length} Lists` : `Official Attachment View — Attachment ${activeItemIndex + 1} of ${attachmentLists.length}`)
                            }
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* View All / Single Toggle when viewing */}
                    {!isEditing && attachmentLists.length > 1 && (
                        <button
                            type="button"
                            onClick={() => {
                                setViewAllMode(!viewAllMode);
                                setPrintScope('all');
                            }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border cursor-pointer ${viewAllMode
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            {viewAllMode ? 'Viewing All Together' : `View All (${attachmentLists.length})`}
                        </button>
                    )}

                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            {savedData && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                                >
                                    <Eye className="w-4 h-4" />
                                    Cancel &amp; View
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={saving || isActiveOverBudget}
                                onClick={handleGenerate}
                                className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition ${
                                    isActiveOverBudget
                                        ? 'bg-rose-500/80 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50'
                                }`}
                                title={isActiveOverBudget ? `Total cost exceeds Allocated Budget (${formatCurrency(activePpmpBudget)})` : 'Save PPMP List of Attachment'}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : isActiveOverBudget ? 'Over Budget' : (attachmentLists.length > 1 ? `Save Attachment (Item ${activeList.itemNo || activeItemIndex + 1})` : 'Save Attachment')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {allowEdit ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(true);
                                        setViewAllMode(false);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-700 transition cursor-pointer"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Edit Fields
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium rounded-lg" title={isScopeLocked ? "PPMP List of Attachment is locked. Approved revision scope is restricted to PPMP/APP procurement items only." : "Document is under formal review and locked from end-user edits."}>
                                    <span>{isScopeLocked ? "Locked (PPMP/APP Scope Only)" : "Locked for Review"}</span>
                                </div>
                            )}

                            {isReadyToPrint ? (
                                <div className="flex items-center gap-2">
                                    {attachmentLists.length > 1 ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handlePrintCurrent}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                                                title={`Print only the active sheet (Attachment List #${activeItemIndex + 1})`}
                                            >
                                                <Printer className="w-4 h-4 text-slate-300" />
                                                <span>Print Current (#{activeItemIndex + 1})</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePrintAll}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer"
                                                title={`Print all ${attachmentLists.length} attachment lists together in one print job`}
                                            >
                                                <Printer className="w-4 h-4" />
                                                <span>Print All Attachments ({attachmentLists.length})</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handlePrintCurrent}
                                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer"
                                        >
                                            <Printer className="w-4 h-4" />
                                            <span>Print PPMP List of Attachment</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-lg" title="Document must be fully approved and in READY TO PRINT status before printing.">
                                    <Printer className="w-4 h-4 opacity-60" />
                                    <span>Print available upon READY TO PRINT status</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="py-8 px-4 sm:px-6">
                {/* Multi-Item Tab Selector Header (shown whenever there are 2 or more procurement rows) */}
                {attachmentLists.length > 1 && (
                    <div className="no-print max-w-5xl mx-auto mb-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        Select Procurement Row Attachment
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
                                            {attachmentLists.length} items to procure
                                        </span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Each procurement row has its own Project Procurement Management Plan Attachment List breakdown.
                                    </p>
                                </div>
                            </div>

                            {!isEditing && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewAllMode(!viewAllMode);
                                            setPrintScope('all');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewAllMode
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        {viewAllMode ? 'Viewing All Together' : 'View All Attachment Lists'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tabs Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {attachmentLists.map((item, idx) => {
                                const isSelected = !viewAllMode && activeItemIndex === idx;
                                const itemBudget = parseFloat(item.ppmpAllocatedBudget !== undefined ? item.ppmpAllocatedBudget : item.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);
                                const itemCalculated = (item.rows || []).reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
                                const itemOverBudget = itemBudget > 0 && itemCalculated > (itemBudget + 0.01);
                                const hasRows = item.rows && item.rows.some(r => r.description || r.qty);

                                return (
                                    <button
                                        key={item.itemKey || idx}
                                        type="button"
                                        onClick={() => {
                                            setViewAllMode(false);
                                            setActiveItemIndex(idx);
                                        }}
                                        className={`p-3 rounded-xl text-left transition border flex items-start gap-3 cursor-pointer ${isSelected
                                            ? itemOverBudget
                                                ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                                                : 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                            : itemOverBudget
                                                ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-300 text-rose-900'
                                                : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                            itemOverBudget
                                                ? 'bg-rose-600 text-white'
                                                : isSelected
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-200 text-slate-700'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-900 truncate" title={item.projectTitle}>
                                                {item.projectTitle || `Item #${idx + 1}`}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                                                <span>Budget: {formatCurrency(itemBudget)}</span>
                                                {itemOverBudget ? (
                                                    <span className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Over Budget
                                                    </span>
                                                ) : hasRows ? (
                                                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                                        <CheckCircle2 className="w-3 h-3" /> Ready
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {isEditing ? (
                    /* CREATE / EDIT FORM VIEW */
                    <div className="max-w-5xl mx-auto space-y-6">
                        {/* Information Banner */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                                {activeItemIndex + 1}
                            </div>
                            <div className="text-xs text-blue-900">
                                <span className="font-bold">
                                    Editing Attachment List #{activeItemIndex + 1} of {attachmentLists.length}:
                                </span>{' '}
                                <span className="font-semibold text-blue-950">{activeList.projectTitle}</span>.
                                Initial allocations and charges have been pre-filled from this procurement row. Customize the item breakdowns, units, prices, and specifications below.
                            </div>
                        </div>

                        {/* Top Header Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                                <span>General Project &amp; Allocation Details</span>
                                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                                    Procurement Row #{activeList.itemNo}
                                </span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        End User / Implementing Unit:
                                    </label>
                                    <input
                                        type="text"
                                        value={activeList.officeName || ''}
                                        onChange={(e) => updateActiveField('officeName', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Office Name"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block font-bold text-slate-700">
                                            Estimated Budget / Authorized Budgetary Allocation (ABC):
                                        </label>
                                        {activeCalculatedTotal > 0 && !isActiveOverBudget && Math.abs((parseFloat(activeList.totalBudget) || 0) - activeCalculatedTotal) > 0.01 && (
                                            <button
                                                type="button"
                                                onClick={() => updateActiveField('totalBudget', activeCalculatedTotal)}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                                                title="Sync budget to coincide with computed sum of item breakdown rows"
                                            >
                                                <Sparkles className="w-3 h-3 text-blue-500" />
                                                Sync with Items Total ({formatCurrency(activeCalculatedTotal)})
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 font-mono">
                                            ₱
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={activePpmpBudget > 0 ? activePpmpBudget : undefined}
                                            value={activeList.totalBudget ?? ''}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? '' : e.target.value;
                                                if (val !== '' && activePpmpBudget > 0 && parseFloat(val) > activePpmpBudget) {
                                                    alert(`The Estimated Budget cannot exceed the Allocated Budget from the PPMP data (${formatCurrency(activePpmpBudget)}).`);
                                                    updateActiveField('totalBudget', activePpmpBudget);
                                                    return;
                                                }
                                                updateActiveField('totalBudget', val);
                                            }}
                                            className={`w-full pl-7 pr-3 py-2 border rounded-lg text-xs font-mono font-bold focus:ring-2 focus:outline-none ${
                                                isActiveOverBudget
                                                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                                                    : 'border-slate-300 focus:ring-blue-500'
                                            }`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="mt-1 text-[11px]">
                                        {isActiveOverBudget ? (
                                            <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 font-bold flex items-center justify-between gap-2 mt-1">
                                                <span className="flex items-center gap-1.5">
                                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                                    <span>Total Cost ({formatCurrency(activeCalculatedTotal)}) exceeds Allocated Budget ({formatCurrency(activePpmpBudget)})</span>
                                                </span>
                                                <span className="text-rose-700 shrink-0 font-extrabold font-mono">
                                                    +{formatCurrency(activeBudgetExcess)} excess
                                                </span>
                                            </div>
                                        ) : activeCalculatedTotal > 0 ? (
                                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                                                {isCoinciding ? (
                                                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        Coincides with Allocated Budget ({formatCurrency(activeCalculatedTotal)})
                                                    </span>
                                                ) : (
                                                    <span className="text-blue-700 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                                        Total Cost ({formatCurrency(activeCalculatedTotal)}) is lower than Allocated Budget ({formatCurrency(activePpmpBudget)}) | Unallocated: {formatCurrency(activeBudgetRemaining)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Program / Project Title:
                                    </label>
                                    <input
                                        type="text"
                                        value={activeList.projectTitle || ''}
                                        onChange={(e) => updateActiveField('projectTitle', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Project Title"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items Table Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                        PPMP List of Attachment Items (Breakdown for {activeList.projectTitle})
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Enter items, units, quantities, and unit costs. The Total Cost must coincide with or be lower than the Allocated Budget (<strong className="font-mono">{formatCurrency(activePpmpBudget)}</strong>).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Item Row
                                </button>
                            </div>

                            {/* Over-budget Warning Alert */}
                            {isActiveOverBudget && (
                                <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-start gap-3 shadow-xs">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <div className="font-extrabold text-rose-900 uppercase tracking-wide">
                                            Budget Limit Exceeded
                                        </div>
                                        <p className="text-rose-800 mt-0.5 font-medium">
                                            The Total Cost of this attachment list (<strong className="font-mono font-extrabold">{formatCurrency(activeCalculatedTotal)}</strong>) is higher than the Allocated Budget from the PPMP data (<strong className="font-mono font-extrabold">{formatCurrency(activePpmpBudget)}</strong>) by <strong className="font-mono font-black text-rose-900">+{formatCurrency(activeBudgetExcess)}</strong>.
                                        </p>
                                        <p className="text-rose-700 text-[11px] mt-1 font-semibold">
                                            Please adjust quantities or unit costs so the total cost coincides with or is lower than the Allocated Budget. Saving is disabled until within budget.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-center text-[11px]">
                                            <th className="p-2 w-12">No.</th>
                                            <th className="p-2 w-28">Unit</th>
                                            <th className="p-2 text-left">Item and Description</th>
                                            <th className="p-2 w-20">Qty</th>
                                            <th className="p-2 w-28">Unit Cost</th>
                                            <th className="p-2 w-32">Total Cost</th>
                                            <th className="p-2 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {activeList.rows.map((row, index) => (
                                            <tr key={row.id || index} className="hover:bg-slate-50">
                                                <td className="p-2 text-center font-mono font-bold text-slate-600">
                                                    {index + 1}
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        value={row.unit || ''}
                                                        onChange={(e) => handleUpdateRow(index, 'unit', e.target.value)}
                                                        placeholder="e.g. roll, pcs, box"
                                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <textarea
                                                        rows={2}
                                                        value={row.description || ''}
                                                        onChange={(e) => handleUpdateRow(index, 'description', e.target.value)}
                                                        placeholder="Item specifications and description..."
                                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs leading-snug resize-y"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        value={row.qty ?? ''}
                                                        onChange={(e) => handleUpdateRow(index, 'qty', e.target.value)}
                                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-mono"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        value={row.unitCost ?? ''}
                                                        onChange={(e) => handleUpdateRow(index, 'unitCost', e.target.value)}
                                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={row.totalCost !== '' && row.totalCost !== null && row.totalCost !== undefined ? formatCurrency(row.totalCost) : ''}
                                                        className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-right font-mono font-bold text-slate-700"
                                                        placeholder="₱0.00"
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRow(index)}
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Another Item
                                </button>
                                <div className="flex flex-wrap items-center gap-4 text-right">
                                    <div>
                                        <span className="text-xs text-slate-500 mr-2">Allocated Budget:</span>
                                        <span className="text-sm font-bold font-mono text-slate-800">
                                            {formatCurrency(activePpmpBudget)}
                                        </span>
                                    </div>
                                    <div className="border-l border-slate-200 pl-4">
                                        <span className="text-xs text-slate-500 mr-2">Items Computed Total:</span>
                                        <span className={`text-sm font-mono ${
                                            isActiveOverBudget
                                                ? 'font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-300'
                                                : isCoinciding
                                                    ? 'font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                                                    : 'font-extrabold text-blue-900'
                                        }`}>
                                            {formatCurrency(activeCalculatedTotal)}
                                        </span>
                                    </div>
                                    {isActiveOverBudget ? (
                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg border border-rose-300 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                            Exceeds Budget by {formatCurrency(activeBudgetExcess)}
                                        </span>
                                    ) : !isActiveOverBudget && activeCalculatedTotal > 0 && Math.abs((parseFloat(activeList.totalBudget) || 0) - activeCalculatedTotal) > 0.01 ? (
                                        <button
                                            type="button"
                                            onClick={() => updateActiveField('totalBudget', activeCalculatedTotal)}
                                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-semibold rounded border border-blue-300 transition cursor-pointer"
                                            title="Update Budget to coincide with Computed Total"
                                        >
                                            Set Budget to {formatCurrency(activeCalculatedTotal)}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Delivery, Payment, and Charges Section */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                    Charges &amp; Delivery Specifications
                                </h3>
                                {attachmentLists.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleCopySettingsToAll}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
                                        title="Copy Office, Charges, Delivery, and Conditions from this item to all attachment lists"
                                    >
                                        {copiedAllFeedback ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-emerald-700 font-bold">Applied to all {attachmentLists.length} lists!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Apply Delivery &amp; Charges to All ({attachmentLists.length}) Lists</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Additional Condition Preset Selector */}
                            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 p-4 rounded-xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <label htmlFor="attachment-condition-select" className="block text-xs font-bold text-slate-800">
                                            Additional Condition / Standard Preset:
                                        </label>
                                        <p className="text-[11px] text-slate-500">
                                            Select pre-defined specifications for Catering Services, POL Condition, Water, Travelling, etc.
                                        </p>
                                    </div>
                                </div>

                                <div className="w-full md:w-80 shrink-0">
                                    <select
                                        id="attachment-condition-select"
                                        value={activeList.additionalCondition}
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Other Terms (Full width across 2 columns) */}
                                <div className="md:col-span-2 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="block font-bold text-slate-700">
                                            Other Terms: <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                                        </label>
                                        {isPolCondition ? (
                                            <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                                                <Lock className="w-2.5 h-2.5" /> POL Condition Applied
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
                                        currentText={activeList.otherTerms}
                                        onSelectTerm={(term) => {
                                            if (term.id === 'CUSTOM') {
                                                updateActiveField('selectedOtherTermId', 'CUSTOM');
                                            } else {
                                                handleOtherTermSelect(term.id);
                                            }
                                        }}
                                        onAppendTerm={(term) => {
                                            handleAppendOtherTerm(term.id);
                                        }}
                                        onClear={() => {
                                            updateActiveField('selectedOtherTermId', '');
                                            updateActiveField('otherTerms', '');
                                        }}
                                        isPolCondition={isPolCondition}
                                    />

                                    <textarea
                                        rows={3}
                                        value={activeList.otherTerms}
                                        onChange={(e) => {
                                            updateActiveField('otherTerms', e.target.value);
                                            updateActiveField('selectedOtherTermId', '');
                                        }}
                                        placeholder="e.g. Green Specification, Contractual terms, or Supplier billing clauses..."
                                        className={`w-full px-3 py-2 border rounded-lg text-xs leading-snug resize-y ${isPolCondition
                                                ? 'border-blue-400 bg-blue-50/20 font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                                : 'border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none'
                                            }`}
                                    />
                                </div>

                                {/* Charges */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        (Charges: e.g. Account Code / Fund Source):
                                    </label>
                                    <input
                                        type="text"
                                        value={activeList.charges || ''}
                                        onChange={(e) => updateActiveField('charges', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="e.g. 5-02-02-100 / CY 2026 General Fund"
                                    />
                                </div>

                                {/* Place of Delivery */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="block font-bold text-slate-700">Place of Delivery:</label>
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
                                        value={isPolCondition ? '' : (findMatchingOption(activeList.placeOfDelivery, placeOfDeliveryOptions, canonicalizePlaceOfDelivery) || (activeList.placeOfDelivery ? 'CUSTOM' : ''))}
                                        onChange={(e) => {
                                            if (e.target.value !== 'CUSTOM') {
                                                updateActiveField('placeOfDelivery', e.target.value);
                                            }
                                        }}
                                        className={`w-full text-xs p-2 mb-1.5 border rounded-lg ${isPolCondition
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
                                        value={isPolCondition ? '' : (activeList.placeOfDelivery || '')}
                                        onChange={(e) => updateActiveField('placeOfDelivery', e.target.value)}
                                        placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. PGSO Warehouse/On-site'}
                                        className={`w-full px-3 py-2 border rounded-lg text-xs ${isPolCondition
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                            }`}
                                    />
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="block font-bold text-slate-700">Payment Method:</label>
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
                                        value={isPolCondition ? '' : (findMatchingOption(activeList.paymentMethod, paymentMethodOptions, canonicalizePaymentMethod) || (activeList.paymentMethod ? 'CUSTOM' : ''))}
                                        onChange={(e) => {
                                            if (e.target.value !== 'CUSTOM') {
                                                updateActiveField('paymentMethod', e.target.value);
                                            }
                                        }}
                                        className={`w-full text-xs p-2 mb-1.5 border rounded-lg ${isPolCondition
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
                                        value={isPolCondition ? '' : (activeList.paymentMethod || '')}
                                        onChange={(e) => updateActiveField('paymentMethod', e.target.value)}
                                        placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. Staggered Delivery/Credit-basis'}
                                        className={`w-full px-3 py-2 border rounded-lg text-xs resize-y ${isPolCondition
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                            }`}
                                    />
                                </div>

                                {/* Delivery Period */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="block font-bold text-slate-700">Delivery Period:</label>
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
                                        value={isPolCondition ? '' : (findMatchingOption(activeList.deliveryPeriod, deliveryPeriodOptions, canonicalizeDeliveryPeriod) || (activeList.deliveryPeriod ? 'CUSTOM' : ''))}
                                        onChange={(e) => {
                                            if (e.target.value !== 'CUSTOM') {
                                                updateActiveField('deliveryPeriod', e.target.value);
                                            }
                                        }}
                                        className={`w-full text-xs p-2 mb-1.5 border rounded-lg ${isPolCondition
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
                                        value={isPolCondition ? '' : (activeList.deliveryPeriod || '')}
                                        onChange={(e) => updateActiveField('deliveryPeriod', e.target.value)}
                                        placeholder={isPolCondition ? 'Locked: Specified in POL Condition terms.' : 'e.g. 30 Calendar Days upon receipt of PO'}
                                        className={`w-full px-3 py-2 border rounded-lg text-xs resize-y ${isPolCondition
                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:italic'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Signatories Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
                                Signatories &amp; Endorsement
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Prepared By (Name):</label>
                                    <input
                                        type="text"
                                        value={endUserName || ''}
                                        onChange={(e) => setEndUserName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={endUserPosition || ''}
                                        onChange={(e) => setEndUserPosition(e.target.value)}
                                        placeholder="Designation"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1.5"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Submitted By (Head):</label>
                                    <input
                                        type="text"
                                        value={headName || ''}
                                        onChange={(e) => setHeadName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={headPosition || ''}
                                        onChange={(e) => setHeadPosition(e.target.value)}
                                        placeholder="Designation"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1.5"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Approved By (Governor):</label>
                                    <input
                                        type="text"
                                        value={approvedByName || ''}
                                        onChange={(e) => setApprovedByName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={approvedByPosition || ''}
                                        onChange={(e) => setApprovedByPosition(e.target.value)}
                                        placeholder="Designation"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1.5"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Navigation / Next / Prev & Save Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2">
                                {activeItemIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveItemIndex(activeItemIndex - 1)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Previous Item
                                    </button>
                                )}
                                {activeItemIndex < attachmentLists.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveItemIndex(activeItemIndex + 1)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                        Next Item <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={saving || isActiveOverBudget}
                                onClick={handleGenerate}
                                className={`flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition ${
                                    isActiveOverBudget
                                        ? 'bg-rose-500/80 text-white cursor-not-allowed opacity-80'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50'
                                }`}
                                title={isActiveOverBudget ? `Total cost exceeds Allocated Budget (${formatCurrency(activePpmpBudget)})` : 'Save PPMP List of Attachment'}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : isActiveOverBudget ? 'Total Exceeds Budget' : (attachmentLists.length > 1 ? `Save Attachment (Item ${activeList.itemNo || activeItemIndex + 1})` : 'Save Attachment')}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* OFFICIAL PRINTABLE VIEW */
                    <div className="space-y-8">
                        {attachmentLists.map((list, idx) => {
                            // If in single-sheet view on screen and not printing all, only show activeItemIndex
                            if (!viewAllMode && printScope !== 'all' && idx !== activeItemIndex) {
                                return null;
                            }

                            const isHiddenInPrint = printScope === 'current' && idx !== activeItemIndex;

                            return (
                                <div
                                    key={list.itemKey || idx}
                                    className={`attachment-sheet-wrapper ${isHiddenInPrint ? 'print:hidden' : ''}`}
                                >
                                    {renderPrintSheet(list, idx)}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
