import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { Printer, Download, ArrowLeft, Plus, Trash2, Edit3, Loader2, Sparkles, ShieldCheck, Truck, Lock, Leaf, CheckCircle2, ChevronRight, ChevronLeft, Eye, Layers, Copy, Check, Save, AlertTriangle, MessageSquare, CheckCheck, Maximize2 } from 'lucide-react';
import { ppmpService, procurementConditionService, otherTermService } from '../../services/api';
import { GreenSpecDropdown } from './GreenSpecDropdown';
import { useSignatureSettings, isSignatoryPnpkiActive, resolveSubmittedBySignatory } from '../../utils/signatureController';
import { CommentableCell } from './CommentableCell';
import { AttachmentUnitCombobox } from './AttachmentUnitCombobox';
import { PrintExportDropdown } from '../UI/PrintExportDropdown';
import {
    RichDescriptionEditor,
    RichDescriptionDisplay,
    isHtmlDescription,
    stripDescriptionHtml,
} from '../UI/RichDescriptionEditor';
import { exportElementsToPdf } from '../../utils/pdfExport';
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

export const getInitialAttachmentLists = (ppmp, procurementItems, savedData) => {
    const rawFundSource = ppmp?.items?.find(i => !i.is_header && i.source_of_fund)?.source_of_fund?.trim() || 'General Fund';
    const fiscalYearStr = ppmp?.fiscal_year ? `CY ${ppmp.fiscal_year}` : '';
    const accountCodeStr = ppmp?.account_code || '';
    const ppmpProgram = (ppmp?.program_name || ppmp?.program || '').trim();

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

        const savedProjectTitle = itemSaved?.project_title ? String(itemSaved.project_title).trim() : '';
        const itemDesc = item.description ? String(item.description).trim() : '';
        let resolvedProjectTitle = ppmpProgram;
        if (savedProjectTitle && savedProjectTitle !== itemDesc && (!ppmpProgram || savedProjectTitle !== String(ppmp?.title || '').trim())) {
            resolvedProjectTitle = savedProjectTitle;
        } else if (!resolvedProjectTitle) {
            resolvedProjectTitle = savedProjectTitle || ppmp?.title || item.description || '';
        }

        return {
            itemId: item.id !== undefined && item.id !== null ? item.id : idx,
            itemKey,
            itemNo: item.item_no || idx + 1,
            isRetention: Boolean(item.is_retention),
            retentionPercentage: item.retention_percentage ?? null,
            sourceDescription: item.description || '',
            ppmpAllocatedBudget,
            officeName: itemSaved?.office_name || savedData?.office_name || ppmp?.implementing_unit || ppmp?.office?.name || 'Provincial Government of Davao del Sur',
            projectTitle: resolvedProjectTitle,
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

export const PPMPAttachmentListView = ({
    ppmp,
    user,
    canEdit = true,
    initialItemId = null,
    onBack,
    onGenerated,
    cellComments = [],
    canComment = false,
    canComply = false,
    currentUser = null,
    onAddCellComment,
    onDeleteCellComment,
    onComplyCellComment,
    onUncomplyCellComment,
    onUpdateCellValue = null,
}) => {
    const savedData = ppmp?.attachment_list_data || null;
    const ppmpProgram = (ppmp?.program_name || ppmp?.program || '').trim();
    const sheetsContainerRef = useRef(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const [activeCellKey, setActiveCellKey] = useState(null);

    const pendingCellComments = useMemo(() => {
        return (cellComments || []).filter(c => c.status === 'pending');
    }, [cellComments]);

    const compliedCellComments = useMemo(() => {
        return (cellComments || []).filter(c => c.status === 'complied');
    }, [cellComments]);

    const getValidItemId = (id) => {
        if (typeof id === 'number' && Number.isInteger(id) && id > 0) return id;
        if (typeof id === 'string' && /^\d+$/.test(id)) {
            const num = parseInt(id, 10);
            return num > 0 ? num : null;
        }
        return null;
    };

    const getCommentProps = (itemId, itemNo, fieldKey, fieldLabel, cellValue, contextData = null) => {
        const resolveTargetListIndex = () => {
            const found = attachmentLists.findIndex(
                (l) =>
                    (l.itemId && itemId && String(l.itemId) === String(itemId)) ||
                    (l.itemNo && itemNo && Number(l.itemNo) === Number(itemNo))
            );
            return found >= 0 ? found : activeItemIndex;
        };

        const updateListFieldByIndex = (targetIdx, field, value) => {
            setAttachmentLists((prev) => {
                const next = [...prev];
                if (!next[targetIdx]) return prev;
                next[targetIdx] = { ...next[targetIdx], [field]: value };
                return next;
            });
        };

        let updateHandler = null;
        if (fieldKey && fieldKey.startsWith('att_r')) {
            const m = fieldKey.match(/^att_r(\d+)_(.+)$/);
            if (m) {
                const rowNum = parseInt(m[1], 10);
                const subField = m[2];
                const targetKey = subField === 'unit_cost' ? 'unitCost' : (subField === 'item_no' ? 'itemNo' : subField);
                updateHandler = async (newVal) => {
                    const targetIdx = resolveTargetListIndex();
                    setAttachmentLists((prev) => {
                        const next = [...prev];
                        const listObj = next[targetIdx];
                        if (!listObj) return prev;
                        const currentRows = [...(listObj.rows || [])];
                        const rowIdx = currentRows.findIndex((r) => (r.itemNo || r.id) == rowNum);
                        if (rowIdx >= 0) {
                            const updatedRow = { ...currentRows[rowIdx], [targetKey]: newVal };
                            if (targetKey === 'qty' || targetKey === 'unitCost') {
                                const q = parseFloat(targetKey === 'qty' ? newVal : updatedRow.qty);
                                const c = parseFloat(targetKey === 'unitCost' ? newVal : updatedRow.unitCost);
                                updatedRow.totalCost = !isNaN(q) && !isNaN(c) && q >= 0 && c >= 0 ? Math.round(q * c * 100) / 100 : '';
                            }
                            currentRows[rowIdx] = updatedRow;
                            next[targetIdx] = { ...listObj, rows: currentRows };
                        }
                        return next;
                    });
                    if (onUpdateCellValue) {
                        await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
                    }
                };
            }
        } else if (fieldKey === 'att_charges') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'charges', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_office_name') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'officeName', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_project_title') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'projectTitle', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_delivery_period') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'deliveryPeriod', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_place_of_delivery') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'placeOfDelivery', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_payment_method') {
            updateHandler = async (newVal) => {
                updateListFieldByIndex(resolveTargetListIndex(), 'paymentMethod', newVal);
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_fiscal_year' || fieldKey === 'att_total_budget') {
            updateHandler = async (newVal) => {
                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        } else if (fieldKey === 'att_other_terms') {
            updateHandler = async (newVal) => {
                let ot = newVal;
                let pod = null;
                let pm = null;
                let dp = null;
                try {
                    const parsed = typeof newVal === 'object' ? newVal : JSON.parse(newVal);
                    if (parsed && typeof parsed === 'object') {
                        ot = parsed.other_terms ?? parsed.otherTerms ?? ot;
                        pod = parsed.place_of_delivery ?? parsed.placeOfDelivery;
                        pm = parsed.payment_method ?? parsed.paymentMethod;
                        dp = parsed.delivery_period ?? parsed.deliveryPeriod;
                    }
                } catch (e) {

                }
                updateActiveField('otherTerms', ot);
                if (pod !== null && pod !== undefined) updateActiveField('placeOfDelivery', pod);
                if (pm !== null && pm !== undefined) updateActiveField('paymentMethod', pm);
                if (dp !== null && dp !== undefined) updateActiveField('deliveryPeriod', dp);

                setAttachmentLists(prev => prev.map(l => {
                    const matches = (l.itemId && itemId && String(l.itemId) === String(itemId)) ||
                                    (l.itemNo && itemNo && Number(l.itemNo) === Number(itemNo)) ||
                                    prev.length === 1;
                    if (matches) {
                        return {
                            ...l,
                            otherTerms: ot,
                            ...(pod !== null && pod !== undefined ? { placeOfDelivery: pod } : {}),
                            ...(pm !== null && pm !== undefined ? { paymentMethod: pm } : {}),
                            ...(dp !== null && dp !== undefined ? { deliveryPeriod: dp } : {}),
                        };
                    }
                    return l;
                }));

                if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, itemId, itemNo, fieldLabel);
            };
        }

        return {
            itemId: getValidItemId(itemId),
            itemNo: typeof itemNo === 'number' ? itemNo : null,
            fieldKey,
            fieldLabel,
            cellValue: cellValue !== null && cellValue !== undefined ? String(cellValue) : '',
            contextData,
            comments: cellComments,
            changeLogs: ppmp?.change_logs || ppmp?.changeLogs || [],
            canComment,
            canComply,
            currentUser: currentUser || user,
            activeCellKey,
            setActiveCellKey,
            onAddCellComment,
            onDeleteCellComment,
            onComplyCellComment,
            onUncomplyCellComment,
            onUpdateCellValue: updateHandler,
        };
    };

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

    const isCreator = ppmp?.created_by === user?.id;
    const isCreatorEditable = isCreator && [
        'DRAFT',
        'HEAD_PENDING',
        'HEAD_APPROVED',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'OPPMO_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'BUDGET_HEAD_RETURNED',
        'PACCO_RETURNED',
        'PACCO_HEAD_RETURNED',
        'OPPMO_RETURNED',
        'OPPMO_HEAD_RETURNED',
        'TWG_RETURNED'
    ].includes(ppmp?.status);

    const isReviewerEditable = (
        (user?.role === 'head' && ['HEAD_PENDING', 'HEAD_APPROVED'].includes(ppmp?.status) && user?.office_id === ppmp?.office_id) ||
        (user?.role === 'head' && ['BUDGET_HEAD_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_HEAD_REVIEW'].includes(ppmp?.status)) ||
        (user?.role === 'budget_officer' && ppmp?.status === 'BUDGET_OFFICER_REVIEW') ||
        (user?.role === 'pacco' && ppmp?.status === 'PACCO_REVIEW') ||
        (user?.role === 'oppmo' && ppmp?.status === 'OPPMO_REVIEW') ||
        (user?.role === 'twg' && ppmp?.status === 'TWG_REVIEW')
    );

    const isScopeLocked = ppmp?.amendment_scope === 'PPMP_APP' && !['admin', 'super_admin'].includes(user?.role);
    const allowEdit = canEdit && !isScopeLocked && (isCreatorEditable || isReviewerEditable || ['admin', 'super_admin'].includes(user?.role));

    const [attachmentLists, setAttachmentLists] = useState(() => {
        return getInitialAttachmentLists(ppmp, procurementItems, savedData);
    });

    const [activeItemIndex, setActiveItemIndex] = useState(() => {
        if (initialItemId !== null && initialItemId !== undefined) {
            const foundIdx = procurementItems.findIndex(i => String(i.id) === String(initialItemId));
            if (foundIdx >= 0) return foundIdx;
        }
        return 0;
    });

    useEffect(() => {
        if (initialItemId !== null && initialItemId !== undefined) {
            const foundIdx = procurementItems.findIndex(i => String(i.id) === String(initialItemId));
            if (foundIdx >= 0) {
                setActiveItemIndex(foundIdx);
            }
        }
    }, [initialItemId, procurementItems]);

    useEffect(() => {
        if (savedData && !isEditing) {
            setAttachmentLists(getInitialAttachmentLists(ppmp, procurementItems, savedData));
        }
    }, [ppmp, savedData]);

    const [isEditing, setIsEditing] = useState(!savedData && allowEdit);
    const [viewAllMode, setViewAllMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [printScope, setPrintScope] = useState('all');
    const [pendingPrint, setPendingPrint] = useState(false);
    const [copiedAllFeedback, setCopiedAllFeedback] = useState(false);

    useEffect(() => {
        if (pendingPrint) {
            const timer = setTimeout(() => {
                setPendingPrint(false);
                window.print();
            }, 180);
            return () => clearTimeout(timer);
        }
    }, [pendingPrint]);

    const activeList = attachmentLists[activeItemIndex] || attachmentLists[0];
    const activeListItemNo = typeof activeList?.itemNo === 'number' ? activeList.itemNo : (activeItemIndex + 1);

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

    const { isEnabled, isPnpkiEnabled: isGlobalPnpkiEnabled } = useSignatureSettings();
    const isAttachmentSignatureEnabled = ppmp?.signature_settings?.attachment_list !== undefined
        ? Boolean(ppmp.signature_settings.attachment_list)
        : isEnabled('attachment_list');
    const isPnpkiSystemEnabled = ppmp?.signature_settings?.pnpki_enabled !== undefined
        ? Boolean(ppmp.signature_settings.pnpki_enabled)
        : isGlobalPnpkiEnabled;

    const isAttachmentAmended = ppmp?.amendment_scope === 'ATTACHMENT_LIST' || ppmp?.amendment_scope === 'ALL';
    const isScopePpmpAppOnly = ppmp?.amendment_scope === 'PPMP_APP';

    const preparedSig = ppmp?.signatures?.find(s => s.role === 'end_user')
        || ppmp?.parent?.signatures?.find(s => s.role === 'end_user')
        || null;

    const hasHeadApproved = Boolean(
        isScopePpmpAppOnly ||
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

    const isPreparedPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(preparedSig, ppmp?.creator);
    const submittedByResolved = resolveSubmittedBySignatory(ppmp, headSig, [
        ppmp?.signatures?.find(s => s.role === 'oppmo_head'),
        ppmp?.signatures?.find(s => s.role === 'budget_head'),
        ppmp?.signatures?.find(s => s.role === 'pacco_head'),
        ...(isScopePpmpAppOnly ? [
            ppmp?.parent?.signatures?.find(s => s.role === 'oppmo_head'),
            ppmp?.parent?.signatures?.find(s => s.role === 'budget_head'),
            ppmp?.parent?.signatures?.find(s => s.role === 'pacco_head'),
        ] : []),
    ], hasHeadApproved);
    const submittedByUser = submittedByResolved.user;
    const submittedBySignedAt = submittedByResolved.signedAt;
    const isHeadPnpki = isPnpkiSystemEnabled && submittedByResolved.isPnpkiActive;
    const isTwgPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(twgSig, ppmp?.twg_reviewer || ppmp?.twgReviewer);
    const hasAnyPnpkiAttachmentSig = isPreparedPnpki || isHeadPnpki || isTwgPnpki;

    const resolvedOfficeHeadName = ppmp?.office_head_name || ppmp?.default_signatories?.submitted_by?.name || ppmp?.default_signatories?.head_of_office?.name || ppmp?.office?.head_name || ppmp?.office?.head?.name || '';
    const resolvedOfficeHeadPosition = ppmp?.office_head_designation || ppmp?.default_signatories?.submitted_by?.position || ppmp?.default_signatories?.head_of_office?.position || ppmp?.office?.designation || ppmp?.office?.head?.designation || 'Head of Office';

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

    const isLegacyGovernor = (val) => {
        if (!val) return false;
        const s = String(val).toUpperCase();
        return s.includes('CAGAS') || s.includes('GOVERNOR');
    };

    const resolvedTwgName = twgSig?.signer_name || twgSig?.user?.name || (user?.role === 'twg' ? user?.name : '');
    const resolvedTwgPosition = twgSig?.signer_designation || twgSig?.user?.designation || (user?.role === 'twg' ? (user?.designation || 'BAC Technical Working Group (TWG) Member') : '');

    const [approvedByName, setApprovedByName] = useState(
        resolvedTwgName || (savedData?.approved_by_name && !isLegacyGovernor(savedData.approved_by_name) ? savedData.approved_by_name : '')
    );
    const [approvedByPosition, setApprovedByPosition] = useState(
        resolvedTwgPosition || (savedData?.approved_by_position && !isLegacyGovernor(savedData.approved_by_position) ? savedData.approved_by_position : '')
    );

    useEffect(() => {
        if (twgSig?.signer_name || twgSig?.user?.name) {
            setApprovedByName(twgSig.signer_name || twgSig.user?.name);
            setApprovedByPosition(twgSig.signer_designation || twgSig.user?.designation || 'BAC Technical Working Group (TWG) Member');
        }
    }, [twgSig]);

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

    const handleGenerate = async () => {

        const activeHasContent = activeList.rows && activeList.rows.some(r => (stripDescriptionHtml(r.description) !== '') || (r.qty && r.qty !== ''));
        if (!activeHasContent) {
            alert('Please add at least one item description or specification to this detailed specification before saving.');
            return;
        }

        for (const list of attachmentLists) {
            const listTotal = (list.rows || []).reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
            const listBudget = parseFloat(list.ppmpAllocatedBudget !== undefined ? list.ppmpAllocatedBudget : list.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);

            if (listBudget > 0 && listTotal > (listBudget + 0.01)) {
                alert(`Cannot save: The Total Cost (${formatCurrency(listTotal)}) of "${list.projectTitle || `Item #${list.itemNo}`}" exceeds the Allocated Budget (${formatCurrency(listBudget)}) from the PPMP data by ${formatCurrency(listTotal - listBudget)}.\n\nThe Total Cost of the Detailed Specifications must coincide with or be lower than the Allocated Budget.`);
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
            console.error('Failed to save Detailed Specifications', error);
            alert(error.response?.data?.message || 'Failed to save Detailed Specifications to server. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const isParentApproved = ppmp?.amendment_scope === 'PPMP_APP' && ppmp?.parent?.status === 'READY_TO_PRINT';
    const isReadyToPrint = ppmp?.status === 'READY_TO_PRINT' || isParentApproved || ['admin', 'super_admin'].includes(user?.role);

    const handlePrintAll = () => {
        if (!isReadyToPrint) {
            alert('Printing is only authorized once the PPMP has reached the READY TO PRINT status after full workflow approval.');
            return;
        }
        setPrintScope('all');
        setViewAllMode(true);
        setPendingPrint(true);
    };

    const handlePrintCurrent = () => {
        if (!isReadyToPrint) {
            alert('Printing is only authorized once the PPMP has reached the READY TO PRINT status after full workflow approval.');
            return;
        }
        setPrintScope('current');
        setPendingPrint(true);
    };

    const activePpmpBudget = parseFloat(activeList.ppmpAllocatedBudget !== undefined ? activeList.ppmpAllocatedBudget : activeList.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);
    const activeCalculatedTotal = activeList.rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
    const activeDisplayTotalBudget = activeCalculatedTotal > 0 ? activeCalculatedTotal : (parseFloat(activeList.totalBudget) || activePpmpBudget);
    const isActiveOverBudget = activePpmpBudget > 0 && activeCalculatedTotal > (activePpmpBudget + 0.01);
    const activeBudgetExcess = isActiveOverBudget ? activeCalculatedTotal - activePpmpBudget : 0;
    const activeBudgetRemaining = activePpmpBudget > activeCalculatedTotal ? activePpmpBudget - activeCalculatedTotal : 0;
    const isCoinciding = activePpmpBudget > 0 && Math.abs(activePpmpBudget - activeCalculatedTotal) <= 0.01;

    const renderPrintSheet = (list, listIdx) => {
        const itemCalculatedTotal = list.rows.reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
        const itemDisplayTotalBudget = itemCalculatedTotal > 0 ? itemCalculatedTotal : (parseFloat(list.totalBudget) || 0);
        const viewRows = list.rows.filter(r => (r.unit || stripDescriptionHtml(r.description) || r.qty || r.unitCost || r.totalCost));
        const listIsPol = list.additionalCondition === 'POL Condition';
        const listItemNo = typeof list.itemNo === 'number' ? list.itemNo : (listIdx + 1);
        const displayProjectTitle = (list.projectTitle && String(list.projectTitle).trim() !== String(list.sourceDescription || '').trim())
            ? list.projectTitle
            : (ppmpProgram || list.projectTitle || '—');

        return (
            <div
                key={list.itemKey || listIdx}
                className={`attachment-sheet p-8 sm:p-12 w-full max-w-[820px] mx-auto bg-white text-black shadow-xl rounded-2xl print:p-0 print:max-w-none print:shadow-none print:rounded-none border border-slate-200 print:border-none ${
                    listIdx > 0 ? 'mt-8 print:mt-0 print:break-before-page' : ''
                }`}
                style={listIdx > 0 ? { breakBefore: 'page', pageBreakBefore: 'always' } : undefined}
            >

                {attachmentLists.length > 1 && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-2 pb-1 border-b border-slate-200 print:border-black/20">
                        <span className="font-bold uppercase text-slate-700 print:text-black">
                            Detailed Specifications {listIdx + 1} of {attachmentLists.length}
                        </span>
                        <span className="text-slate-500">
                            Procurement Row #{list.itemNo}: {list.sourceDescription.slice(0, 45)}...
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-center gap-4 mb-5 text-center">
                    <img
                        src="/images/logo.png"
                        alt="Provincial Seal"
                        className="w-16 h-16 object-contain shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="space-y-0.5">
                        <div className="text-base sm:text-lg font-extrabold uppercase tracking-tight leading-snug">
                            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) {' '}
                            <CommentableCell
                                as="span"
                                {...getCommentProps(list.itemId, listItemNo, 'att_fiscal_year', `Detailed Specifications #${listItemNo} • Fiscal Year`, `CY ${ppmp?.fiscal_year || new Date().getFullYear()}`)}
                                className="inline-block px-1 rounded"
                            >
                                CY {ppmp?.fiscal_year || new Date().getFullYear()}
                            </CommentableCell>
                        </div>
                        <div className="text-sm font-bold tracking-tight">
                            Provincial Government of Davao del Sur
                        </div>
                        <div className="text-sm font-bold tracking-tight">
                            Matti, Digos City
                        </div>
                    </div>
                </div>

                <div className="text-sm font-extrabold space-y-1.5 mb-4 pt-1">
                    <CommentableCell
                        as="div"
                        {...getCommentProps(list.itemId, listItemNo, 'att_office_name', `Detailed Specifications #${listItemNo} • End-User / Implementing Unit`, list.officeName)}
                        className="p-0.5 rounded"
                    >
                        End User/ Implementing Unit: <span className="font-bold uppercase">{list.officeName}</span>
                    </CommentableCell>
                    <CommentableCell
                        as="div"
                        {...getCommentProps(list.itemId, listItemNo, 'att_project_title', `Detailed Specifications #${listItemNo} • Program / Project Title`, displayProjectTitle)}
                        className="p-0.5 rounded"
                    >
                        Program/Project Title: <span className="font-bold uppercase">{displayProjectTitle}</span>
                    </CommentableCell>
                    <CommentableCell
                        as="div"
                        {...getCommentProps(list.itemId, listItemNo, 'att_charges', `Detailed Specifications #${listItemNo} • Charges`, list.charges || '—')}
                        className="p-0.5 rounded"
                    >
                        Charges: <span className="font-bold">{list.charges || '—'}</span>
                    </CommentableCell>
                </div>

                <table className="w-full table-fixed border-collapse border-2 border-black text-[13px] font-bold">
                    <thead>
                        <tr className="border-b-2 border-black font-extrabold text-center bg-slate-50">
                            <th className="border border-black px-1.5 py-2 w-[7%]">Item No.</th>
                            <th className="border border-black px-1.5 py-2 w-[10%]">Unit</th>
                            <th className="border border-black px-2.5 py-2 text-left w-[38%]">Item and Description</th>
                            <th className="border border-black px-1.5 py-2 w-[8%]">Qty</th>
                            <th className="border border-black px-1.5 py-2 w-[18%]">Unit Cost</th>
                            <th className="border border-black px-1.5 py-2 w-[19%]">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {viewRows.map((row, idx) => {
                            const rowNum = row.itemNo || idx + 1;
                            return (
                                <tr key={idx} className="h-8 border border-black font-bold">
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_item_no`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Item No.`, row.itemNo)}
                                        className="border border-black text-center px-1.5 py-1.5 tabular-nums font-extrabold break-words"
                                    >
                                        {row.itemNo}
                                    </CommentableCell>
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_unit`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Unit`, row.unit)}
                                        className="border border-black text-center px-1.5 py-1.5 font-bold text-black break-words"
                                    >
                                        {row.unit}
                                    </CommentableCell>
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_description`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Description`, stripDescriptionHtml(row.description))}
                                        className={`border border-black px-2.5 py-1.5 text-black break-words align-top ${isHtmlDescription(row.description) ? 'font-normal' : 'font-bold'}`}
                                    >
                                        <RichDescriptionDisplay value={row.description} />
                                    </CommentableCell>
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_qty`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Quantity`, row.qty)}
                                        className="border border-black text-center px-1.5 py-1.5 tabular-nums font-bold break-words"
                                    >
                                        {row.qty}
                                    </CommentableCell>
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_unit_cost`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Unit Cost`, row.unitCost ? formatCurrency(row.unitCost) : '')}
                                        className="border border-black text-right px-1.5 py-1.5 tabular-nums text-[12px] font-bold break-words"
                                    >
                                        {row.unitCost ? formatCurrency(row.unitCost) : ''}
                                    </CommentableCell>
                                    <CommentableCell
                                        as="td"
                                        {...getCommentProps(list.itemId, listItemNo, `att_r${rowNum}_total_cost`, `Detailed Specifications #${listItemNo} • Row #${rowNum} Total Cost`, row.totalCost !== null && row.totalCost !== undefined && row.totalCost !== '' ? formatCurrency(row.totalCost) : '')}
                                        className="border border-black text-right px-1.5 py-1.5 tabular-nums text-[12px] font-extrabold break-words"
                                    >
                                        {row.totalCost !== null && row.totalCost !== undefined && row.totalCost !== '' ? formatCurrency(row.totalCost) : ''}
                                    </CommentableCell>
                                </tr>
                            );
                        })}

                        <tr className="border-t-2 border-black">
                            <td colSpan={2} className="border border-black"></td>
                            <CommentableCell
                                as="td"
                                {...getCommentProps(
                                    list.itemId,
                                    listItemNo,
                                    'att_other_terms',
                                    `Detailed Specifications #${listItemNo} • Other Terms & Delivery Info`,
                                    list.otherTerms || list.placeOfDelivery || list.deliveryPeriod || 'Other Terms',
                                    {
                                        otherTerms: list.otherTerms || '',
                                        placeOfDelivery: list.placeOfDelivery || 'PGSO Warehouse/On-site',
                                        paymentMethod: list.paymentMethod || 'Staggered Delivery/Credit-basis',
                                        deliveryPeriod: list.deliveryPeriod || 'As Per Demand by the End-User',
                                    }
                                )}
                                className="border border-black p-2.5 font-bold space-y-1.5 text-xs align-top break-words"
                            >
                                {list.otherTerms ? (
                                    <div className="mb-1.5 pb-1.5 border-b border-dashed border-black/40 font-bold whitespace-pre-wrap leading-relaxed">
                                        {list.otherTerms}
                                    </div>
                                ) : null}

                                {!listIsPol && list.placeOfDelivery ? (
                                    <div className="mt-1">
                                        Place of Delivery: <span className="font-bold">{list.placeOfDelivery}</span>
                                    </div>
                                ) : null}
                                {!listIsPol && list.paymentMethod ? (
                                    <div>
                                        Payment Method: <span className="font-bold">{list.paymentMethod}</span>
                                    </div>
                                ) : null}
                                {!listIsPol && list.deliveryPeriod ? (
                                    <div>
                                        Delivery Period: <span className="font-bold">{list.deliveryPeriod}</span>
                                    </div>
                                ) : null}
                            </CommentableCell>
                            <td colSpan={2} className="border border-black p-2.5 text-right text-sm font-extrabold uppercase align-top">
                                TOTAL
                            </td>
                            <CommentableCell
                                as="td"
                                {...getCommentProps(list.itemId, listItemNo, 'att_total_budget', `Detailed Specifications #${listItemNo} • Total Estimated Budget`, formatCurrency(itemCalculatedTotal > 0 ? itemCalculatedTotal : itemDisplayTotalBudget))}
                                className="border border-black px-1.5 py-2.5 text-right text-[13px] tabular-nums font-extrabold align-top break-words"
                            >
                                {formatCurrency(itemCalculatedTotal > 0 ? itemCalculatedTotal : itemDisplayTotalBudget)}
                            </CommentableCell>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-5 text-xs font-bold bg-white print-signature-box">
                    <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                            <div className="font-extrabold text-xs mb-1">Prepared By:</div>
                            <div className="text-center flex flex-col items-center justify-end">
                                {isAttachmentSignatureEnabled && preparedSig?.user?.signature_path ? (
                                    <>
                                        <div className={`h-8 flex items-center justify-center ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                            <img
                                                src={`/api/users/${encodeURIComponent(preparedSig.user.encrypted_id)}/signature`}
                                                alt="Signature"
                                                className="max-h-8 max-w-[120px] object-contain"
                                            />
                                        </div>
                                        {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                    </>
                                ) : (isAttachmentSignatureEnabled && preparedSig?.signature_indicator) ? (
                                    <>
                                        <div className={`inline-flex flex-col items-center mb-1 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[10px] font-mono">
                                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                <span>{preparedSig.signature_indicator}</span>
                                            </div>
                                        </div>
                                        {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                    </>
                                ) : (
                                    <div className="h-6" />
                                )}
                                <div className="font-extrabold text-sm uppercase underline whitespace-nowrap leading-snug">
                                    {endUserName}
                                </div>
                                <div className="text-xs font-bold text-black whitespace-nowrap mt-0.5">
                                    {endUserPosition}
                                </div>
                                {isAttachmentSignatureEnabled && preparedSig?.signed_at && (
                                    <div className={`text-[10px] font-bold text-slate-700 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                        Date/Time: {formatDate(preparedSig.signed_at)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="font-extrabold text-xs mb-1">Submitted By:</div>
                            <div className="text-center flex flex-col items-center justify-end">
                                <div className="h-8" />
                                <div className="font-extrabold text-sm uppercase underline whitespace-nowrap leading-snug">
                                    {headName && headName !== 'NAME OF HEAD' ? headName : (resolvedOfficeHeadName || 'NAME OF HEAD')}
                                </div>
                                <div className="text-xs font-bold text-black whitespace-nowrap mt-0.5">
                                    {headPosition && headPosition !== 'Head of Office' ? headPosition : (resolvedOfficeHeadPosition || 'Head of Office')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="text-center flex flex-col items-center justify-end">
                            <div className="font-extrabold text-xs uppercase mb-1">APPROVED BY (TWG):</div>
                            {isAttachmentSignatureEnabled && twgSig?.user?.signature_path ? (
                                <>
                                    <div className={`h-8 flex items-center justify-center ${!isTwgPnpki ? 'no-print print:hidden' : ''}`}>
                                        <img
                                            src={`/api/users/${encodeURIComponent(twgSig.user.encrypted_id)}/signature`}
                                            alt="Signature"
                                            className="max-h-8 max-w-[120px] object-contain"
                                        />
                                    </div>
                                    {!isTwgPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                </>
                            ) : (isAttachmentSignatureEnabled && twgSig?.signature_indicator) ? (
                                <>
                                    <div className={`inline-flex flex-col items-center mb-1 ${!isTwgPnpki ? 'no-print print:hidden' : ''}`}>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 border border-cyan-300 rounded text-cyan-800 text-[10px] font-mono">
                                            <ShieldCheck className="w-3 h-3 text-cyan-600" />
                                            <span>{twgSig.signature_indicator}</span>
                                        </div>
                                    </div>
                                    {!isTwgPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                </>
                            ) : (
                                <div className="h-6" />
                            )}
                            <div className="font-extrabold text-sm uppercase underline whitespace-nowrap leading-snug">
                                {twgSig?.signer_name || twgSig?.user?.name || (approvedByName && !isLegacyGovernor(approvedByName) ? approvedByName : '')}
                            </div>
                            <div className="text-xs font-bold text-black whitespace-nowrap mt-0.5">
                                {twgSig?.signer_designation || twgSig?.user?.designation || (approvedByPosition && !isLegacyGovernor(approvedByPosition) ? approvedByPosition : (twgSig ? 'BAC TWG' : ''))}
                            </div>
                            {isAttachmentSignatureEnabled && twgSig?.signed_at && (
                                <div className={`text-[10px] font-bold text-slate-700 ${!isTwgPnpki ? 'no-print print:hidden' : ''}`}>
                                    Date/Time: {formatDate(twgSig.signed_at)}
                                </div>
                            )}
                        </div>
                    </div>

                    {isAttachmentSignatureEnabled && (
                        <div className={`mt-4 pt-2 border-t border-dotted border-slate-300 text-center ${!hasAnyPnpkiAttachmentSig ? 'no-print print:hidden' : ''}`}>
                            <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                                * This is an electronically generated document under the Electronic Procurement Management System. Signatures affixed with a valid PNPKI Digital E-Signature are electronically certified; others require a physical/handwritten signature.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-100 min-h-screen font-sans text-slate-800">

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
                    /* Remove all comment outline rings, box shadows, and background colors during printing */
                    .attachment-sheet,
                    .attachment-sheet * {
                        box-shadow: none !important;
                        -webkit-box-shadow: none !important;
                        outline: none !important;
                    }
                    .attachment-sheet [class*="ring-"] {
                        box-shadow: none !important;
                        -webkit-box-shadow: none !important;
                        outline: none !important;
                    }
                    .attachment-sheet [class*="bg-emerald-"],
                    .attachment-sheet [class*="bg-red-"],
                    .attachment-sheet [class*="bg-amber-"] {
                        background-color: transparent !important;
                        background: transparent !important;
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
                            DETAILED SPECIFICATIONS (PPMP)
                            {attachmentLists.length > 1 && (
                                <span className="text-[10px] bg-blue-600 text-white font-mono px-2 py-0.5 rounded-full">
                                    {attachmentLists.length} Specifications
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                            {isEditing
                                ? `Data Entry — Editing Detailed Specifications ${activeItemIndex + 1} of ${attachmentLists.length}`
                                : (viewAllMode ? `Official Detailed Specifications View — Viewing All ${attachmentLists.length} Sheets` : `Official Detailed Specifications View — Sheet ${activeItemIndex + 1} of ${attachmentLists.length}`)
                            }
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">

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
                                title={isActiveOverBudget ? `Total cost exceeds Allocated Budget (${formatCurrency(activePpmpBudget)})` : 'Save Detailed Specifications'}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : isActiveOverBudget ? 'Over Budget' : (attachmentLists.length > 1 ? `Save Specifications (Item ${activeList.itemNo || activeItemIndex + 1})` : 'Save Detailed Specifications')}
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
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium rounded-lg" title={isScopeLocked ? "Detailed Specifications are locked. Approved revision scope is restricted to PPMP/APP procurement items only." : "Document is under formal review and locked from end-user edits."}>
                                    <span>{isScopeLocked ? "Locked (PPMP/APP Scope Only)" : "Locked for Review"}</span>
                                </div>
                            )}

                            {isReadyToPrint ? (
                                <div className="flex items-center gap-2">
                                    {attachmentLists.length > 1 ? (
                                        <PrintExportDropdown
                                            label="Print / Download PDF"
                                            isExporting={isExportingPdf}
                                            menuWidth={268}
                                            extraOptions={[
                                                {
                                                    key: 'print-current',
                                                    icon: Printer,
                                                    iconBg: 'bg-blue-50 text-blue-600',
                                                    label: `Print Current Sheet (#${activeItemIndex + 1})`,
                                                    sublabel: 'Open browser print dialog for active sheet',
                                                    onClick: handlePrintCurrent,
                                                },
                                                {
                                                    key: 'print-all',
                                                    icon: Printer,
                                                    iconBg: 'bg-indigo-50 text-indigo-600',
                                                    label: `Print All Specifications (${attachmentLists.length})`,
                                                    sublabel: 'Print all sheets in one print job',
                                                    onClick: handlePrintAll,
                                                },
                                                { divider: true },
                                                {
                                                    key: 'download-current',
                                                    icon: Download,
                                                    iconBg: 'bg-emerald-50 text-emerald-600',
                                                    label: `Download Current PDF (#${activeItemIndex + 1})`,
                                                    sublabel: 'Save active specification sheet as .pdf',
                                                    onClick: async () => {
                                                        if (!sheetsContainerRef.current || isExportingPdf) return;
                                                        setIsExportingPdf(true);
                                                        try {
                                                            const sheets = Array.from(sheetsContainerRef.current.querySelectorAll('.attachment-sheet'));
                                                            const targetSheet = viewAllMode ? (sheets[activeItemIndex] || sheets[0]) : sheets[0];
                                                            const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'PPMP';
                                                            await exportElementsToPdf({
                                                                element: targetSheet,
                                                                filename: `Detailed_Specifications_${tracker}_Item_${activeItemIndex + 1}.pdf`,
                                                                orientation: 'portrait',
                                                                format: 'a4',
                                                                marginMm: 8,
                                                            });
                                                        } catch (err) {
                                                            console.error('Failed to export Detailed Specifications PDF:', err);
                                                            alert('Failed to generate PDF file. Please try printing and choosing Save as PDF.');
                                                        } finally {
                                                            setIsExportingPdf(false);
                                                        }
                                                    },
                                                },
                                                {
                                                    key: 'download-all',
                                                    icon: Download,
                                                    iconBg: 'bg-teal-50 text-teal-600',
                                                    label: `Download All PDF (${attachmentLists.length} Sheets)`,
                                                    sublabel: 'Export all specification sheets into one .pdf',
                                                    onClick: async () => {
                                                        if (isExportingPdf) return;
                                                        const prevViewAll = viewAllMode;
                                                        const prevScope = printScope;
                                                        setIsExportingPdf(true);
                                                        setViewAllMode(true);
                                                        setPrintScope('all');
                                                        try {
                                                            await new Promise((r) => setTimeout(r, 150));
                                                            const sheets = sheetsContainerRef.current
                                                                ? Array.from(sheetsContainerRef.current.querySelectorAll('.attachment-sheet'))
                                                                : [];
                                                            const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'PPMP';
                                                            await exportElementsToPdf({
                                                                elements: sheets,
                                                                filename: `Detailed_Specifications_${tracker}_All.pdf`,
                                                                orientation: 'portrait',
                                                                format: 'a4',
                                                                marginMm: 8,
                                                            });
                                                        } catch (err) {
                                                            console.error('Failed to export Detailed Specifications PDF:', err);
                                                            alert('Failed to generate PDF file. Please try printing and choosing Save as PDF.');
                                                        } finally {
                                                            setViewAllMode(prevViewAll);
                                                            setPrintScope(prevScope);
                                                            setIsExportingPdf(false);
                                                        }
                                                    },
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <PrintExportDropdown
                                            label="Print / Download PDF"
                                            printLabel="Print Detailed Specifications"
                                            printSublabel="Open browser print dialog"
                                            downloadLabel="Download Specifications (PDF)"
                                            downloadSublabel="Save Detailed Specifications as .pdf file"
                                            onPrint={handlePrintCurrent}
                                            onDownloadPdf={async () => {
                                                if (!sheetsContainerRef.current || isExportingPdf) return;
                                                setIsExportingPdf(true);
                                                try {
                                                    const sheets = Array.from(sheetsContainerRef.current.querySelectorAll('.attachment-sheet'));
                                                    const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'PPMP';
                                                    await exportElementsToPdf({
                                                        elements: sheets,
                                                        filename: `Detailed_Specifications_${tracker}.pdf`,
                                                        orientation: 'portrait',
                                                        format: 'a4',
                                                        marginMm: 8,
                                                    });
                                                } catch (err) {
                                                    console.error('Failed to export Detailed Specifications PDF:', err);
                                                    alert('Failed to generate PDF file. Please try printing and choosing Save as PDF.');
                                                } finally {
                                                    setIsExportingPdf(false);
                                                }
                                            }}
                                            isExporting={isExportingPdf}
                                        />
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

            <div className="py-8 px-4 sm:px-6">

                {attachmentLists.length > 1 && (
                    <div className="no-print max-w-5xl mx-auto mb-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 flex-wrap">
                                        Select Procurement Row Specifications
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
                                            {attachmentLists.filter(i => !i.isRetention).length} to procure
                                        </span>
                                        {attachmentLists.some(i => i.isRetention) && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-mono font-semibold border border-amber-300">
                                                + {attachmentLists.filter(i => i.isRetention).length} retention (optional)
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Each procurement row has its own detailed specifications. Retention rows are optional — you may create specifications for them or leave them blank.
                                    </p>
                                </div>
                            </div>

                            {!isEditing && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextViewAll = !viewAllMode;
                                            setViewAllMode(nextViewAll);
                                            setPrintScope(nextViewAll ? 'all' : 'current');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewAllMode
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        {viewAllMode ? 'Viewing All Together' : 'View All Detailed Specifications'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {attachmentLists.map((item, idx) => {
                                const isSelected = !viewAllMode && activeItemIndex === idx;
                                const itemBudget = parseFloat(item.ppmpAllocatedBudget !== undefined ? item.ppmpAllocatedBudget : item.totalBudget) || (parseFloat(ppmp?.total_budget) || 0);
                                const itemCalculated = (item.rows || []).reduce((sum, r) => sum + (parseFloat(r.totalCost) || 0), 0);
                                const itemOverBudget = itemBudget > 0 && itemCalculated > (itemBudget + 0.01);
                                const hasRows = item.rows && item.rows.some(r => stripDescriptionHtml(r.description) || r.qty);
                                const tabItemNo = item.itemNo || idx + 1;
                                const tabComments = (cellComments || []).filter(c =>
                                    (item.itemId && c.item_id && String(c.item_id) === String(item.itemId)) ||
                                    (c.item_no !== undefined && c.item_no !== null && Number(c.item_no) === Number(tabItemNo))
                                );
                                const tabPendingCount = tabComments.filter(c => c.status === 'pending').length;
                                const tabCompliedCount = tabComments.filter(c => c.status === 'complied').length;

                                return (
                                    <button
                                        key={item.itemKey || idx}
                                        type="button"
                                        onClick={() => {
                                            setViewAllMode(false);
                                            setActiveItemIndex(idx);
                                            setPrintScope('current');
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
                                            <div className="text-xs font-bold text-slate-900 truncate flex items-center justify-between gap-1" title={item.sourceDescription || item.projectTitle}>
                                                <span className="truncate flex items-center gap-1.5">
                                                    <span className="truncate">{item.sourceDescription || item.projectTitle || `Item #${idx + 1}`}</span>
                                                    {item.isRetention && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                                            Optional
                                                        </span>
                                                    )}
                                                </span>
                                                {tabPendingCount > 0 ? (
                                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white shadow-2xs shrink-0 no-print" title={`${tabPendingCount} pending finding(s)`}>
                                                        💬 {tabPendingCount}
                                                    </span>
                                                ) : tabCompliedCount > 0 ? (
                                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-2xs shrink-0 no-print" title="Complied">
                                                        ✓
                                                    </span>
                                                ) : null}
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
                                                ) : item.isRetention ? (
                                                    <span className="text-[10px] text-amber-700 font-semibold">
                                                        Optional
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

                {cellComments && cellComments.length > 0 && (
                    <div className="max-w-5xl mx-auto mb-6 no-print">
                        <div className={`p-4 rounded-xl border text-xs space-y-2.5 transition shadow-2xs ${
                            pendingCellComments.length > 0
                                ? 'bg-red-50/95 border-red-300'
                                : 'bg-emerald-50/95 border-emerald-300'
                        }`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className={`p-1.5 rounded-lg ${
                                        pendingCellComments.length > 0
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        <MessageSquare className="w-4 h-4" />
                                    </span>
                                    <span className="font-bold uppercase tracking-wide text-xs text-slate-900">
                                        Reviewer Cell Comments &amp; Compliance Tracker
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                        pendingCellComments.length > 0
                                            ? 'bg-red-200 text-red-900 border border-red-400'
                                            : 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                                    }`}>
                                        {pendingCellComments.length > 0
                                            ? `${pendingCellComments.length} PENDING COMPLIANCE`
                                            : 'ALL COMPLIED (100%)'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-[11px] font-medium text-slate-700">
                                <span>Total Cell Findings: <strong>{cellComments.length}</strong></span>
                                <span className="text-red-800 font-semibold">• Pending Action: <strong>{pendingCellComments.length}</strong></span>
                                <span className="text-emerald-800 font-semibold">• Complied: <strong>{compliedCellComments.length}</strong></span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-2 transition-all duration-300 ${pendingCellComments.length === 0 ? 'bg-emerald-600' : 'bg-red-500'}`}
                                    style={{ width: `${cellComments.length > 0 ? (compliedCellComments.length / cellComments.length) * 100 : 0}%` }}
                                />
                            </div>

                            {pendingCellComments.length > 0 ? (
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[11px] font-bold text-red-900 uppercase tracking-wide">
                                        Required Actions Before Resubmission:
                                    </span>
                                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                        {pendingCellComments.map((c) => {
                                            const targetListIdx = attachmentLists.findIndex(
                                                l => (c.item_id && String(l.itemId) === String(c.item_id)) ||
                                                     (c.item_no !== undefined && c.item_no !== null && Number(l.itemNo) === Number(c.item_no))
                                            );
                                            return (
                                                <div
                                                    key={c.id}
                                                    className="p-2.5 bg-white border border-red-200 rounded-lg flex items-start justify-between gap-3 text-[11px] shadow-2xs hover:border-red-300 transition"
                                                >
                                                    <div className="space-y-0.5 min-w-0">
                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (targetListIdx >= 0) {
                                                                        setActiveItemIndex(targetListIdx);
                                                                        setViewAllMode(false);
                                                                    }
                                                                }}
                                                                className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-900 rounded font-mono text-[10px] cursor-pointer"
                                                                title="Switch to this detailed specification"
                                                            >
                                                                {c.item_no ? `Detailed Specifications #${c.item_no}` : 'Header'}
                                                            </button>
                                                            <span>{c.field_label || c.field_key}</span>
                                                        </div>
                                                        <div className="text-slate-800 font-medium whitespace-pre-wrap">"{c.comment}"</div>
                                                        <div className="text-[10px] text-slate-500">
                                                            Comment by: {c.reviewer_name || 'Reviewer'} ({c.reviewer_role?.toUpperCase()})
                                                        </div>
                                                    </div>
                                                    {canComply && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const note = window.prompt(`Enter compliance note for [${c.field_label || c.field_key}] (optional):`);
                                                                if (note !== null && onComplyCellComment) {
                                                                    onComplyCellComment(c.id, note);
                                                                }
                                                            }}
                                                            className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                                        >
                                                            Mark Complied
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-lg text-[11px] text-emerald-900 font-medium flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                                            <span>All reviewer cell comments have been complied with.</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded border border-emerald-400 shrink-0">
                                            {compliedCellComments.length} Complied
                                        </span>
                                    </div>
                                    {compliedCellComments.length > 0 && (
                                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">
                                                Complied Reviewer Findings ({compliedCellComments.length}):
                                            </div>
                                            {compliedCellComments.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="p-2 bg-white/95 border border-emerald-200 rounded-lg flex items-start justify-between gap-3 text-[11px] shadow-2xs"
                                                >
                                                    <div className="space-y-0.5">
                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px]">
                                                                {c.item_no ? `Detailed Specifications #${c.item_no}` : 'Header'}
                                                            </span>
                                                            <span>{c.field_label || c.field_key}</span>
                                                        </div>
                                                        <div className="text-slate-700">"{c.comment}"</div>
                                                        {c.compliance_note && (
                                                            <div className="text-[10px] text-emerald-800 font-medium">
                                                                ✓ Compliance Note: {c.compliance_note}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="shrink-0 text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                                                        <CheckCheck className="w-3.5 h-3.5" /> Complied
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isEditing ? (

                    <div className="max-w-5xl mx-auto space-y-6">

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">
                                {activeItemIndex + 1}
                            </div>
                            <div className="text-xs text-blue-900">
                                <span className="font-bold">
                                    Editing Detailed Specifications #{activeItemIndex + 1} of {attachmentLists.length}:
                                </span>{' '}
                                <span className="font-semibold text-blue-950">{activeList.projectTitle}</span>.
                                Initial allocations and charges have been pre-filled from this procurement row. Customize the item breakdowns, units, prices, and specifications below.
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                                <span>General Project &amp; Allocation Details</span>
                                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                                    Procurement Row #{activeList.itemNo}
                                </span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_office_name', `Detailed Specifications #${activeListItemNo} • End-User / Implementing Unit`, activeList.officeName)}
                                    className="p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_total_budget', `Detailed Specifications #${activeListItemNo} • Total Estimated Budget (ABC)`, activeList.totalBudget)}
                                    className="p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_project_title', `Detailed Specifications #${activeListItemNo} • Program / Project Title`, activeList.projectTitle)}
                                    className="md:col-span-2 p-1 rounded-lg"
                                >
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Program / Project Title:
                                    </label>
                                    <input
                                        type="text"
                                        value={activeList.projectTitle || ''}
                                        onChange={(e) => updateActiveField('projectTitle', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="Program / Project Title"
                                    />
                                </CommentableCell>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                        Detailed Specifications Items (Breakdown for {activeList.sourceDescription || activeList.projectTitle})
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

                            {isActiveOverBudget && (
                                <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-start gap-3 shadow-xs">
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <div className="font-extrabold text-rose-900 uppercase tracking-wide">
                                            Budget Limit Exceeded
                                        </div>
                                        <p className="text-rose-800 mt-0.5 font-medium">
                                            The Total Cost of this detailed specification (<strong className="font-mono font-extrabold">{formatCurrency(activeCalculatedTotal)}</strong>) is higher than the Allocated Budget from the PPMP data (<strong className="font-mono font-extrabold">{formatCurrency(activePpmpBudget)}</strong>) by <strong className="font-mono font-black text-rose-900">+{formatCurrency(activeBudgetExcess)}</strong>.
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
                                            <th className="p-2 w-36">Unit</th>
                                            <th className="p-2 text-left">Item and Description</th>
                                            <th className="p-2 w-20">Qty</th>
                                            <th className="p-2 w-28">Unit Cost</th>
                                            <th className="p-2 w-32">Total Cost</th>
                                            <th className="p-2 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {activeList.rows.map((row, index) => {
                                            const rowNum = row.itemNo || index + 1;
                                            return (
                                                <tr key={row.id || index} className="hover:bg-slate-50">
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_item_no`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Item No.`, row.itemNo)}
                                                        className="p-2 text-center font-mono font-bold text-slate-600 align-top pt-3"
                                                    >
                                                        {index + 1}
                                                    </CommentableCell>
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_unit`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Unit`, row.unit)}
                                                        className="p-2 align-top"
                                                    >
                                                        <AttachmentUnitCombobox
                                                            value={row.unit || ''}
                                                            onChange={(newUnit) => handleUpdateRow(index, 'unit', newUnit)}
                                                            placeholder="e.g. roll, pcs"
                                                        />
                                                    </CommentableCell>
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_description`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Description`, stripDescriptionHtml(row.description))}
                                                        className="p-2 align-top"
                                                    >
                                                        <RichDescriptionEditor
                                                            value={row.description || ''}
                                                            onChange={(val) => handleUpdateRow(index, 'description', val)}
                                                            placeholder="Item specifications and description..."
                                                        />
                                                    </CommentableCell>
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_qty`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Quantity`, row.qty)}
                                                        className="p-2"
                                                    >
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            value={row.qty ?? ''}
                                                            onChange={(e) => handleUpdateRow(index, 'qty', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-mono"
                                                            placeholder="0"
                                                        />
                                                    </CommentableCell>
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_unit_cost`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Unit Cost`, row.unitCost)}
                                                        className="p-2"
                                                    >
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            value={row.unitCost ?? ''}
                                                            onChange={(e) => handleUpdateRow(index, 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono"
                                                            placeholder="0.00"
                                                        />
                                                    </CommentableCell>
                                                    <CommentableCell
                                                        as="td"
                                                        {...getCommentProps(activeList.itemId, activeListItemNo, `att_r${rowNum}_total_cost`, `Detailed Specifications #${activeListItemNo} • Row #${rowNum} Total Cost`, row.totalCost)}
                                                        className="p-2"
                                                    >
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={row.totalCost !== '' && row.totalCost !== null && row.totalCost !== undefined ? formatCurrency(row.totalCost) : ''}
                                                            className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-right font-mono font-bold text-slate-700"
                                                            placeholder="₱0.00"
                                                        />
                                                    </CommentableCell>
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
                                            );
                                        })}
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
                                        title="Copy Office, Charges, Delivery, and Conditions from this item to all detailed specifications"
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

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_other_terms', `Detailed Specifications #${activeListItemNo} • Other Terms`, activeList.otherTerms)}
                                    className="md:col-span-2 space-y-1.5 p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_charges', `Detailed Specifications #${activeListItemNo} • Charges`, activeList.charges)}
                                    className="p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_place_of_delivery', `Detailed Specifications #${activeListItemNo} • Place of Delivery`, activeList.placeOfDelivery)}
                                    className="space-y-1 p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_payment_method', `Detailed Specifications #${activeListItemNo} • Payment Method`, activeList.paymentMethod)}
                                    className="space-y-1 p-1 rounded-lg"
                                >
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
                                </CommentableCell>

                                <CommentableCell
                                    as="div"
                                    {...getCommentProps(activeList.itemId, activeListItemNo, 'att_delivery_period', `Detailed Specifications #${activeListItemNo} • Delivery Period`, activeList.deliveryPeriod)}
                                    className="space-y-1 p-1 rounded-lg"
                                >
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
                                </CommentableCell>
                            </div>
                        </div>

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
                                    <label className="block font-bold text-slate-700 mb-1">Approved By (TWG):</label>
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
                                title={isActiveOverBudget ? `Total cost exceeds Allocated Budget (${formatCurrency(activePpmpBudget)})` : 'Save Detailed Specifications'}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : isActiveOverBudget ? 'Total Exceeds Budget' : (attachmentLists.length > 1 ? `Save Specifications (Item ${activeList.itemNo || activeItemIndex + 1})` : 'Save Detailed Specifications')}
                            </button>
                        </div>
                    </div>
                ) : (

                    <div ref={sheetsContainerRef} className="space-y-8">
                        {attachmentLists.map((list, idx) => {
                            const isOtherSheet = idx !== activeItemIndex;

                            if (!viewAllMode && printScope !== 'all' && isOtherSheet) {
                                return null;
                            }

                            const isHiddenOnScreen = !viewAllMode && isOtherSheet;
                            const isHiddenInPrint = printScope === 'current' && isOtherSheet;

                            return (
                                <div
                                    key={list.itemKey || idx}
                                    className={`attachment-sheet-wrapper ${isHiddenOnScreen ? 'hidden print:block' : ''} ${isHiddenInPrint ? 'print:hidden' : ''}`}
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
