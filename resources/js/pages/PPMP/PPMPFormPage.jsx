import React, { useState, useEffect, useMemo } from 'react';
import { ppmpService, procurementConditionService, otherTermService, supportingDocumentService, procurementModeService } from '../../services/api';
import { ProcurementPlanTable } from '../../components/PPMP/ProcurementPlanTable';
import { GreenSpecDropdown } from '../../components/PPMP/GreenSpecDropdown';
import { ArrowLeft, Save, Send, AlertCircle, FileCheck, Truck, Sparkles, Lock, Leaf } from 'lucide-react';
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

export const PPMPFormPage = ({ user, initialPpmp = null, initialSourceOfFund = 'General Fund', onBack, onSaved }) => {
    const isEditMode = !!initialPpmp;

    const isAttachmentOnly = Boolean(
        isEditMode &&
        (initialPpmp?.amendment_scope === 'ATTACHMENT_LIST' || initialPpmp?.amendment?.amendment_scope === 'ATTACHMENT_LIST') &&
        !['admin', 'super_admin'].includes(user?.role)
    );

    const cleanInitialFund = (initialPpmp?.source_of_fund === 'General Fund and etc..' ? 'General Fund' : initialPpmp?.source_of_fund) ||
        (initialSourceOfFund === 'General Fund and etc..' ? 'General Fund' : initialSourceOfFund) ||
        'General Fund';

    const [sourceOfFund, setSourceOfFund] = useState(cleanInitialFund);
    const [ppmpNumber, setPpmpNumber] = useState(
        (initialPpmp?.ppmp_number !== undefined && initialPpmp?.ppmp_number !== null) ? initialPpmp.ppmp_number : ''
    );
    const [title, setTitle] = useState(initialPpmp?.title || '');
    const [accountCode, setAccountCode] = useState(initialPpmp?.account_code || '');
    const [fiscalYear, setFiscalYear] = useState(initialPpmp?.fiscal_year || new Date().getFullYear().toString());
    const [planType, setPlanType] = useState(initialPpmp?.plan_type || 'INDICATIVE');
    const [implementingUnit, setImplementingUnit] = useState(initialPpmp?.implementing_unit || initialPpmp?.office?.name || '');
    const [programName, setProgramName] = useState(initialPpmp?.program_name || '');
    const [deliveryPeriod, setDeliveryPeriod] = useState(initialPpmp?.delivery_period || '');
    const [placeOfDelivery, setPlaceOfDelivery] = useState(initialPpmp?.place_of_delivery || '');
    const [paymentMethod, setPaymentMethod] = useState(initialPpmp?.payment_method || '');
    const [additionalCondition, setAdditionalCondition] = useState(initialPpmp?.additional_condition || '');
    const [warrantyAndOtherTerms, setWarrantyAndOtherTerms] = useState(initialPpmp?.warranty_and_other_terms || '');

    // Dynamic procurement conditions state
    const [conditions, setConditions] = useState([]);
    const [loadingConditions, setLoadingConditions] = useState(false);

    // Dynamic Other Terms & Green Specifications state
    const [otherTermsList, setOtherTermsList] = useState([]);
    const [loadingOtherTerms, setLoadingOtherTerms] = useState(false);
    const [selectedOtherTermId, setSelectedOtherTermId] = useState('');

    // Dynamic Supporting Documents state
    const [supportingDocsList, setSupportingDocsList] = useState([]);

    // Dynamic Modes of Procurement state
    const [procurementModesList, setProcurementModesList] = useState([]);

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
            // Automatically put the POL Condition specification in Other Terms
            const polText = found?.other_terms || POL_TERMS_TEXT;
            setWarrantyAndOtherTerms(polText);
            // Clear and lock Delivery Period, Place of Delivery, and Payment Method
            setDeliveryPeriod('');
            setPlaceOfDelivery('');
            setPaymentMethod('');
            return;
        }

        // If switching away from POL Condition, clear Other Terms if it still has the auto-filled POL text
        if (warrantyAndOtherTerms === POL_TERMS_TEXT) {
            setWarrantyAndOtherTerms('');
        }

        if (found) {
            setPlaceOfDelivery(found.place_of_delivery || '');
            setDeliveryPeriod(found.delivery_period || '');
            setPaymentMethod(found.payment_method || '');
            // For other conditions, Other Terms is strictly manual input only as requested
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
                    description: it.description || '',
                    quantity_size: it.quantity_size || '',
                    source_of_fund: cleanFund,
                    start_date: it.start_date || '',
                    end_date: it.end_date || '',
                    delivery_period: it.delivery_period || '',
                    supporting_docs_text: it.supporting_docs_text || '',
                    remarks: it.remarks || '',
                    estimated_budget: (it.estimated_budget !== null && it.estimated_budget !== undefined) ? it.estimated_budget : 0,
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
                source_of_fund: '',
                estimated_budget: 0,
                supporting_docs_text: '',
                remarks: '',
            }
        ];
    });

    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const totalBudget = items.reduce((sum, item) => sum + (parseFloat(item.estimated_budget) || 0), 0);

    const isTrustFund = Boolean(
        sourceOfFund && sourceOfFund.toLowerCase().includes('trust')
    );

    // Hide Funding Source & Review Route banner if editing a PPMP that is on a reviewer or under active review
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

    const handleFundChange = (newFund) => {
        setSourceOfFund(newFund);
        // Also update any item source of fund that matches old fund or is empty
        setItems(prevItems => prevItems.map(item => ({
            ...item,
            source_of_fund: item.source_of_fund === sourceOfFund || !item.source_of_fund ? newFund : item.source_of_fund
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
                description: '',
                project_type: 'Goods',
                quantity_size: '',
                procurement_mode: defaultProcMode,
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
                    // Automatic check Pre-Procurement Conference if 5 million and above
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
            setErrorMessage('PPMP procurement items and plan details are locked for this revision. The approved request scope is restricted to the PPMP List of Attachment only.');
            return;
        }

        // Basic validation
        if (!title.trim()) {
            setErrorMessage('Please provide a descriptive Project Title / Objective.');
            return;
        }

        const invalidItem = items.filter(i => !i.is_header).find(item => !item.description?.trim());
        if (invalidItem) {
            setErrorMessage('All item rows must have a description.');
            return;
        }

        setLoading(true);

        const payload = {
            ppmp_number: ppmpNumber.trim(),
            title: title.trim(),
            source_of_fund: sourceOfFund,
            account_code: accountCode.trim(),
            fiscal_year: sanitizeFiscalYear(fiscalYear) || String(new Date().getFullYear()),
            plan_type: planType,
            implementing_unit: implementingUnit.trim(),
            program_name: programName ? programName.trim() : null,
            delivery_period: isPolCondition ? '' : deliveryPeriod,
            place_of_delivery: isPolCondition ? '' : placeOfDelivery,
            payment_method: isPolCondition ? '' : paymentMethod,
            additional_condition: additionalCondition,
            warranty_and_other_terms: warrantyAndOtherTerms,
            items: items.map(item => ({
                ...item,
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
            {/* Action Bar */}
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
                        disabled={loading || isAttachmentOnly}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition ${
                            isAttachmentOnly
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                        }`}
                        title={isAttachmentOnly ? 'PPMP procurement items are locked for this revision.' : ''}
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
                            <span>The approved request scope is restricted to updating the <strong>PPMP List of Attachment</strong> only. Procurement items and plan details cannot be edited.</span>
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

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-800 text-xs font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Funding Source & Review Workflow Banner */}
            {!isUnderReviewOrOnReviewer && (
                <div className={`p-4 rounded-xl border-2 transition-all ${isTrustFund
                        ? 'bg-teal-50/70 border-teal-300 ring-2 ring-teal-500/10'
                        : 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/10'
                    }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 mb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Source of Fund:
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isTrustFund
                                    ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                                }`}>
                                {sourceOfFund}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Change Fund:</span>
                            <button
                                type="button"
                                onClick={() => handleFundChange('General Fund')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${!isTrustFund
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                    }`}
                            >
                                General Fund
                            </button>
                            <button
                                type="button"
                                onClick={() => handleFundChange('Trust Fund')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${isTrustFund
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                    }`}
                            >
                                Trust Fund
                            </button>
                        </div>
                    </div>

                    {/* Review Route Indicator */}
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                        <span className="font-bold text-slate-600 text-[11px] uppercase tracking-wider">
                            Review Route to Ready to Print:
                        </span>
                        {isTrustFund ? (
                            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium text-slate-700">
                                <span className="px-2 py-0.5 rounded bg-teal-200/80 text-teal-950 border border-teal-300 font-bold">
                                    PACCO Reviewer
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold">
                                    OPPMO
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 font-semibold">
                                    BAC-TWG
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold">
                                    OPPMO (Generate APP)
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
                                    Head (Approval)
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                                    Ready to Print
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium text-slate-700">
                                <span className="px-2 py-0.5 rounded bg-indigo-200/80 text-indigo-950 border border-indigo-300 font-bold">
                                    Budget Officer
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold">
                                    OPPMO
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 font-semibold">
                                    BAC-TWG
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold">
                                    OPPMO (Generate APP)
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
                                    Head (Approval)
                                </span>
                                <span className="text-slate-400 font-bold">➔</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                                    Ready to Print
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Official PPMP Header Form Block (Province of Davao del Sur) */}
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

                {/* Form fields: PPMP Number, Fiscal Year, Plan Type, Implementing Office */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    <div>
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
                    </div>

                    <div>
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
                    </div>

                    <div>
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
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                            Implementing Office / Unit:
                        </label>
                        <input
                            type="text"
                            required
                            value={implementingUnit ?? ''}
                            onChange={(e) => setImplementingUnit(e.target.value)}
                            placeholder="e.g. Office of the Provincial Procurement Management Officer"
                            className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                        />
                    </div>
                </div>

                <div className="mb-5">
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
                </div>

                {/* Delivery Specifications & Conditions */}
                <div className="pt-4 border-t border-slate-200 space-y-4">
                    {/* Additional Condition Preset Selector */}
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

                    {/* Delivery Period, Place of Delivery, Payment Method, Other Terms */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Delivery Period */}
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

                        {/* Place of Delivery */}
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

                        {/* Payment Method */}
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

                        {/* Other Terms */}
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
                            {/* Quick Append helper if an option is selected and textarea has text */}
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

            {/* PPMP Items Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wide">
                        Procurement Plan Items & Schedule
                    </h3>
                    <span className="text-xs text-slate-500">
                        Total {items.length} item {items.length === 1 ? 'row' : 'rows'}
                    </span>
                </div>

                <ProcurementPlanTable
                    items={items}
                    isEditable={true}
                    onAddItem={handleAddItem}
                    onRemoveItem={handleRemoveItem}
                    onUpdateItem={handleUpdateItem}
                    totalBudget={totalBudget}
                    accountCode={accountCode}
                    onAccountCodeChange={setAccountCode}
                    programName={programName}
                    onProgramNameChange={setProgramName}
                    supportingDocuments={supportingDocsList}
                    procurementModes={procurementModesList}
                />
            </div>
        </form>
    );
};
