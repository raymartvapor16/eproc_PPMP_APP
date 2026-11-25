import React, { useState, useMemo, useRef } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import {
    ArrowLeft,
    Save,
    Edit3,
    Eye,
    Loader2,
    CheckCircle2,
    CheckCheck,
    MessageSquare,
    AlertTriangle,
    ClipboardCheck,
    Printer,
} from 'lucide-react';
import { ppmpService } from '../../services/api';
import { CommentableCell } from './CommentableCell';
import { PrintExportDropdown } from '../UI/PrintExportDropdown';
import { exportElementsToPdf } from '../../utils/pdfExport';
import { useSignatureSettings, isSignatoryPnpkiActive, resolveSubmittedBySignatory } from '../../utils/signatureController';

export const MARKET_SCOPING_ACTIVITIES = [
    {
        code: 'consultations',
        activity: 'Consultations with suppliers / contractors / consultants / professional associations or industry groups',
        documentation: 'Highlights of consultations or meetings/ Proof of attendance/ Reports / Summaries/ Screenshots / Brochures / Publications/ Price quotations/ Canvass sheets/ Market Analysis Report or similar document/s',
    },
    {
        code: 'summits_fora',
        activity: 'Participation in summits, fora, or conferences',
        documentation: 'Highlights of consultations or meetings/ Proof of Attendance/ Reports',
    },
    {
        code: 'technical_reports',
        activity: 'Review of technical, financial, or market/scientific reports',
        documentation: 'Reports / Summaries/ Screenshots / Brochures / Publications, Market Analysis Report or similar document/ Online Product Reviews',
    },
    {
        code: 'brochures_materials',
        activity: 'Review of product or service brochures, marketing materials, industry journals and publications or related materials',
        documentation: 'Reports / Summaries/ Screenshots / Brochures / Publications/ Online Product Reviews',
    },
    {
        code: 'price_sourcing',
        activity: 'Price sourcing for quotations or cost estimates from suppliers, contractors, or consultants',
        documentation: 'Price quotations/ Canvass sheets/ Online Product Reviews',
    },
    {
        code: 'philgeps_websites',
        activity: 'Use of data from PhilGEPS or agency websites',
        documentation: 'Reports / Summaries/ Screenshots, Price quotations/ Canvass sheets/ PhilGEPS Postings/ Online Product Reviews',
    },
    {
        code: 'other_analogous',
        activity: 'Other analogous market scoping activity/ies undertaken:',
        documentation: '',
        isOther: true,
    },
];

export const MARKET_SCOPING_PARAMETERS = [
    {
        code: 'project_cost_estimate',
        letter: 'a.',
        title: 'Project Cost Estimate',
        question: '[Does the cost estimate align with current market prices?]',
        presets: [
            'Cost estimate aligns with current market prices based on recent supplier quotations and canvass sheets.',
            'Updated ABC / estimated budget to reflect prevailing market rates.',
            'No adjustment needed; current budgetary allocation is realistic and sufficient.',
        ],
    },
    {
        code: 'project_design_specification',
        letter: 'b.',
        title: 'Project Design and Specification',
        question: '[Does available supplier/s meet technical and financial requirements?]',
        presets: [
            'Multiple qualified suppliers/contractors in the market can meet the proposed technical and financial requirements.',
            'Specifications refined to ensure open competition and avoid restrictive brand requirements.',
        ],
    },
    {
        code: 'technical_criteria',
        letter: 'c.',
        title: 'Technical Criteria',
        question: '[Does the market support the proposed technical requirements?]',
        presets: [
            'Market fully supports the proposed technical criteria and quality standards.',
            'Technical criteria aligned with readily available industry-standard specifications.',
        ],
    },
    {
        code: 'delivery_lead_time',
        letter: 'd.',
        title: 'Delivery Lead Time',
        question: '[Are the timelines for delivery feasible?]',
        presets: [
            'Proposed delivery lead time is feasible based on supplier availability and logistics.',
            'Adjusted delivery schedule to accommodate standard supplier fulfillment lead times.',
        ],
    },
    {
        code: 'storage_warehousing',
        letter: 'e.',
        title: 'Storage and Warehousing Requirements',
        question: '[Can the storage/ warehousing needs be met considering specific conditions like temperature, humidity, and handling?]',
        presets: [
            'PGSO Warehouse / End-User storage facility can accommodate the items under required handling conditions.',
            'Staggered delivery / direct on-site delivery recommended to minimize storage constraints.',
            'Not applicable for this procurement project.',
        ],
    },
    {
        code: 'identified_risks',
        letter: 'f.',
        title: 'Identified Risk/s',
        question: '[Were there any market risks identified? (e.g., limited suppliers, price volatility)]',
        presets: [
            'Minimal market risk identified; sufficient local and regional suppliers are available.',
            'Price volatility noted; monitor prevailing market rates and include standard price contingency clauses.',
            'Limited supplier pool; early procurement activity and wide posting on PhilGEPS recommended.',
        ],
    },
];

const CONSIDERED_OPTIONS = [
    { value: '', label: '-- Select --' },
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
    { value: 'Not Applicable', label: 'Not Applicable' },
];

const formatMonthInputToMMYYYY = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}$/.test(str)) {
        const [y, m] = str.split('-');
        return `${m}/${y}`;
    }
    return str;
};

const formatMMYYYYToMonthInput = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}$/.test(str)) return str;
    const m = str.match(/^(\d{2})\/(\d{4})$/);
    if (m) return `${m[2]}-${m[1]}`;
    return '';
};

export const PPMPMarketScopingView = ({
    ppmp,
    user,
    canEdit = true,
    onBack,
    onSaved,
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
    const savedScoping = ppmp?.market_scoping || ppmp?.marketScoping || null;
    const sheetRef = useRef(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [activeCellKey, setActiveCellKey] = useState(null);

    const { isEnabled, isPnpkiEnabled: isGlobalPnpkiEnabled } = useSignatureSettings();
    const isSignatureEnabled = ppmp?.signature_settings?.ppmp !== undefined
        ? Boolean(ppmp.signature_settings.ppmp)
        : isEnabled('ppmp');
    const isPnpkiSystemEnabled = ppmp?.signature_settings?.pnpki_enabled !== undefined
        ? Boolean(ppmp.signature_settings.pnpki_enabled)
        : isGlobalPnpkiEnabled;

    const isCreator = ppmp?.created_by === user?.id;
    const isCreatorEditable = isCreator && [
        'DRAFT',
        'HEAD_PENDING',
        'HEAD_APPROVED',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'BUDGET_HEAD_RETURNED',
        'PACCO_RETURNED',
        'PACCO_HEAD_RETURNED',
        'OPPMO_RETURNED',
        'OPPMO_HEAD_RETURNED',
        'TWG_RETURNED',
    ].includes(ppmp?.status);

    const isReviewerEditable = (
        (user?.role === 'head' && ['HEAD_PENDING', 'HEAD_APPROVED'].includes(ppmp?.status) && user?.office_id === ppmp?.office_id) ||
        (user?.role === 'head' && ['BUDGET_HEAD_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_HEAD_REVIEW'].includes(ppmp?.status)) ||
        (user?.role === 'budget_officer' && ppmp?.status === 'BUDGET_OFFICER_REVIEW') ||
        (user?.role === 'pacco' && ppmp?.status === 'PACCO_REVIEW') ||
        (user?.role === 'oppmo' && ppmp?.status === 'OPPMO_REVIEW') ||
        (user?.role === 'twg' && ppmp?.status === 'TWG_REVIEW')
    );

    const allowEdit = canEdit && (isCreatorEditable || isReviewerEditable || ['admin', 'super_admin'].includes(user?.role));
    const [isEditing, setIsEditing] = useState(!savedScoping && allowEdit);
    const [saving, setSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState('');

    const defaultOffice = ppmp?.implementing_unit || ppmp?.office?.name || '';
    const defaultRepName = ppmp?.creator?.name || user?.name || '';
    const defaultRepDesignation = ppmp?.creator?.designation || user?.designation || '';
    const defaultRepCombined = [defaultRepName, defaultRepDesignation].filter(Boolean).join(' — ');
    const defaultHeadName =
        ppmp?.office_head_name ||
        ppmp?.default_signatories?.submitted_by?.name ||
        ppmp?.office?.head?.name ||
        ppmp?.office?.head_name ||
        '';
    const defaultHeadPosition =
        ppmp?.office_head_designation ||
        ppmp?.default_signatories?.submitted_by?.position ||
        ppmp?.office?.head?.designation ||
        ppmp?.office?.designation ||
        'Head of Office';
    const firstItemDelivery = (ppmp?.items || []).find((i) => !i.is_header && i.delivery_period)?.delivery_period || ppmp?.delivery_period || '';

    const [procuringEntity, setProcuringEntity] = useState(
        savedScoping?.procuring_entity || 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR'
    );
    const [implementingUnit, setImplementingUnit] = useState(
        savedScoping?.implementing_unit || defaultOffice
    );
    const [representative, setRepresentative] = useState(
        savedScoping?.representative_name_designation || defaultRepCombined
    );
    const [projectName, setProjectName] = useState(
        savedScoping?.project_name || ppmp?.title || ''
    );
    const [estimatedBudget, setEstimatedBudget] = useState(
        savedScoping?.estimated_budget !== undefined && savedScoping?.estimated_budget !== null
            ? String(savedScoping.estimated_budget)
            : String(ppmp?.total_budget || 0)
    );
    const [scopingFrom, setScopingFrom] = useState(savedScoping?.scoping_period_from || '');
    const [scopingTo, setScopingTo] = useState(savedScoping?.scoping_period_to || '');
    const [expectedDelivery, setExpectedDelivery] = useState(
        savedScoping?.expected_delivery_date || firstItemDelivery || ''
    );

    const [preparedByName, setPreparedByName] = useState(savedScoping?.prepared_by_name || defaultRepName);
    const [preparedByPosition, setPreparedByPosition] = useState(savedScoping?.prepared_by_position || defaultRepDesignation);
    const [preparedByDate, setPreparedByDate] = useState(
        savedScoping?.prepared_by_date || new Date().toISOString().slice(0, 10)
    );
    const [approvedByName, setApprovedByName] = useState(savedScoping?.approved_by_name || defaultHeadName);
    const [approvedByPosition, setApprovedByPosition] = useState(savedScoping?.approved_by_position || defaultHeadPosition);
    const [approvedByDate, setApprovedByDate] = useState(savedScoping?.approved_by_date || '');

    const [activitiesState, setActivitiesState] = useState(() => {
        const savedList = savedScoping?.activities || [];
        return MARKET_SCOPING_ACTIVITIES.map((def, idx) => {
            const match = savedList.find((a) => a.activity_code === def.code);
            return {
                activity_code: def.code,
                is_checked: Boolean(match?.is_checked),
                custom_activity_text: match?.custom_activity_text || '',
                documentation_notes: match?.documentation_notes || '',
                sort_order: idx + 1,
            };
        });
    });

    const [resultsState, setResultsState] = useState(() => {
        const savedList = savedScoping?.results || [];
        return MARKET_SCOPING_PARAMETERS.map((def, idx) => {
            const match = savedList.find((r) => r.parameter_code === def.code);
            return {
                parameter_code: def.code,
                considered: match?.considered || '',
                recommendations: match?.recommendations || '',
                sort_order: idx + 1,
            };
        });
    });

    const signatures = ppmp?.signatures || [];
    const preparedSig = signatures.find((s) => s.role === 'end_user') || ppmp?.parent?.signatures?.find((s) => s.role === 'end_user') || null;
    const hasHeadApproved = Boolean(ppmp?.head_approved_at || ppmp?.status === 'READY_TO_PRINT');
    const headSig = hasHeadApproved ? (signatures.find((s) => s.role === 'head') || null) : null;
    const isPreparedPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(preparedSig, ppmp?.creator);
    const submittedByResolved = resolveSubmittedBySignatory(
        ppmp,
        headSig,
        [
            signatures.find((s) => s.role === 'oppmo_head'),
            signatures.find((s) => s.role === 'budget_head'),
            signatures.find((s) => s.role === 'pacco_head'),
        ],
        hasHeadApproved
    );
    const submittedByUser = submittedByResolved.user;
    const isHeadPnpki = isPnpkiSystemEnabled && submittedByResolved.isPnpkiActive;

    const msComments = useMemo(
        () => (cellComments || []).filter((c) => String(c.field_key || '').startsWith('ms_')),
        [cellComments]
    );
    const pendingMsComments = useMemo(() => msComments.filter((c) => c.status === 'pending'), [msComments]);
    const compliedMsComments = useMemo(() => msComments.filter((c) => c.status === 'complied'), [msComments]);

    const getCommentProps = (fieldKey, fieldLabel, cellValue, localUpdater = null) => ({
        itemId: null,
        itemNo: null,
        fieldKey,
        fieldLabel,
        cellValue: cellValue !== null && cellValue !== undefined ? String(cellValue) : '',
        comments: msComments,
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
        onUpdateCellValue: async (newVal) => {
            if (localUpdater) localUpdater(newVal);
            if (onUpdateCellValue) await onUpdateCellValue(fieldKey, newVal, null, null, fieldLabel);
        },
    });

    const parsePeriodValue = (val) => {
        const raw = String(val || '').trim();
        const m = raw.match(/from\s+([^\s]+)\s+to\s+([^\s]+)/i);
        if (m) {
            return {
                from: m[1].replace(/_/g, '').trim(),
                to: m[2].replace(/_/g, '').trim(),
            };
        }
        const parts = raw.split(/\s+(?:to|-)\s+/i);
        return {
            from: (parts[0] || '').replace(/^from\s+/i, '').replace(/_/g, '').trim(),
            to: (parts[1] || parts[0] || '').replace(/_/g, '').trim(),
        };
    };

    const setActivityChecked = (code, nextVal) => {
        const norm = String(nextVal ?? '').trim().toUpperCase();
        const isChecked = ['CHECKED', 'YES', '1', 'TRUE', '✓'].includes(norm) || nextVal === true;
        setActivitiesState((prev) =>
            prev.map((a) => (a.activity_code === code ? { ...a, is_checked: isChecked } : a))
        );
    };

    const toggleActivity = (code) => {
        setActivitiesState((prev) =>
            prev.map((a) => (a.activity_code === code ? { ...a, is_checked: !a.is_checked } : a))
        );
    };

    const updateActivityField = (code, field, value) => {
        setActivitiesState((prev) =>
            prev.map((a) => (a.activity_code === code ? { ...a, [field]: value } : a))
        );
    };

    const updateResultField = (code, field, value) => {
        setResultsState((prev) =>
            prev.map((r) => (r.parameter_code === code ? { ...r, [field]: value } : r))
        );
    };

    const handleSave = async () => {
        if (saving) return;
        const checkedCount = activitiesState.filter((a) => a.is_checked).length;
        if (checkedCount === 0) {
            alert('Please check at least one Market Scoping Activity conducted in Section 3 before saving.');
            return;
        }

        setSaving(true);
        setSaveFeedback('');
        try {
            const payload = {
                procuring_entity: procuringEntity.trim() || 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR',
                implementing_unit: implementingUnit.trim(),
                representative_name_designation: representative.trim(),
                project_name: projectName.trim(),
                estimated_budget: parseFloat(estimatedBudget) || 0,
                scoping_period_from: scopingFrom.trim(),
                scoping_period_to: scopingTo.trim(),
                expected_delivery_date: expectedDelivery.trim(),
                prepared_by_name: preparedByName.trim(),
                prepared_by_position: preparedByPosition.trim(),
                prepared_by_date: preparedByDate.trim(),
                approved_by_name: approvedByName.trim(),
                approved_by_position: approvedByPosition.trim(),
                approved_by_date: approvedByDate.trim(),
                activities: activitiesState,
                results: resultsState,
            };

            const res = await ppmpService.saveMarketScoping(ppmp.uuid, payload);
            setIsEditing(false);
            setSaveFeedback('Market Scoping Checklist saved successfully.');
            if (onSaved && res.data?.ppmp) {
                onSaved(res.data.ppmp);
            }
        } catch (err) {
            console.error('Failed to save Market Scoping:', err);
            alert(err.response?.data?.message || 'Failed to save Market Scoping Checklist.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!sheetRef.current || isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'PPMP';
            await exportElementsToPdf({
                element: sheetRef.current,
                filename: `Market_Scoping_${tracker}.pdf`,
                orientation: 'portrait',
                format: 'a4',
                marginMm: 8,
            });
        } catch (err) {
            console.error('Failed to export Market Scoping PDF:', err);
            alert('Failed to generate Market Scoping PDF. Please try printing and choosing Save as PDF.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const scopingPeriodDisplay =
        scopingFrom || scopingTo
            ? `From ${formatMonthInputToMMYYYY(scopingFrom) || '____'} To ${formatMonthInputToMMYYYY(scopingTo) || '____'}`
            : '—';

    return (
        <div className="min-h-screen bg-slate-100 pb-12 print:bg-white print:pb-0">
            <style>{`
                @media print {
                    @page {
                        size: portrait !important;
                        margin: 8mm !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, .no-print * {
                        display: none !important;
                    }
                    .print-signature-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            `}</style>

            <div className="no-print bg-slate-900 text-white px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md sticky top-0 z-30">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer text-slate-200 hover:text-white shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to PPMP Details
                    </button>
                    <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2 truncate">
                            <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>NGPA MARKET SCOPING CHECKLIST (RA 12009)</span>
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono truncate">
                            Tracker No.: {ppmp?.tracking_number || ppmp?.ppmp_number || '—'} &bull; {isEditing ? 'Edit Mode' : 'Official View / Print Mode'}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isEditing ? (
                        <>
                            {savedScoping && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                                >
                                    <Eye className="w-4 h-4" />
                                    Cancel &amp; View
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleSave}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Market Scoping'}
                            </button>
                        </>
                    ) : (
                        <>
                            {allowEdit && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-700 transition cursor-pointer"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Edit Form
                                </button>
                            )}
                            <PrintExportDropdown
                                label="Print / Download PDF"
                                printLabel="Print Market Scoping"
                                printSublabel="Open browser print dialog (Portrait)"
                                downloadLabel="Download Market Scoping (PDF)"
                                downloadSublabel="Save official checklist as .pdf file"
                                onPrint={handlePrint}
                                onDownloadPdf={handleDownloadPdf}
                                isExporting={isExportingPdf}
                            />
                        </>
                    )}
                </div>
            </div>

            <div className="py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-5">
                {saveFeedback && (
                    <div className="no-print p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{saveFeedback}</span>
                    </div>
                )}

                {msComments.length > 0 && (
                    <div className={`no-print rounded-2xl border p-4 shadow-xs ${
                        pendingMsComments.length > 0
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-emerald-50/70 border-emerald-200'
                    }`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                <MessageSquare className="w-4 h-4 text-rose-600" />
                                <span>Market Scoping Reviewer Cell Comments</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    pendingMsComments.length > 0
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                }`}>
                                    {pendingMsComments.length > 0 ? `${pendingMsComments.length} Pending` : 'ALL COMPLIED (100%)'}
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600">
                                Total: {msComments.length} &bull; Complied: {compliedMsComments.length}
                            </span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {msComments.map((c) => (
                                <div key={c.id} className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] flex items-start justify-between gap-2">
                                    <div>
                                        <span className="font-bold text-slate-900">{c.field_label || c.field_key}:</span>{' '}
                                        <span className="text-slate-700">"{c.comment}"</span>
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-bold flex items-center gap-1 ${
                                        c.status === 'complied' ? 'text-emerald-700' : 'text-rose-600'
                                    }`}>
                                        {c.status === 'complied' ? <><CheckCheck className="w-3 h-3" /> Complied</> : <><AlertTriangle className="w-3 h-3" /> Pending</>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isEditing ? (

                    <div className="space-y-5">

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                1. Agency Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="md:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">Name of Procuring Entity:</label>
                                    <input
                                        type="text"
                                        value={procuringEntity}
                                        onChange={(e) => setProcuringEntity(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">End-User / Implementing Unit:</label>
                                    <input
                                        type="text"
                                        value={implementingUnit}
                                        onChange={(e) => setImplementingUnit(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Name &amp; Designation of Representative:</label>
                                    <input
                                        type="text"
                                        value={representative}
                                        onChange={(e) => setRepresentative(e.target.value)}
                                        placeholder="e.g. Juan Dela Cruz — Admin Officer II"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                2. Project Overview
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="md:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">Project Name:</label>
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Estimated Budget (PhP):</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={estimatedBudget}
                                        onChange={(e) => setEstimatedBudget(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Expected Date of Delivery (mm/yyyy):</label>
                                    <input
                                        type="text"
                                        value={expectedDelivery}
                                        onChange={(e) => setExpectedDelivery(e.target.value)}
                                        placeholder="e.g. 11/2026 or 11/2026 - 12/2026"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Period of Market Scoping — From (mm/yyyy):</label>
                                    <input
                                        type="month"
                                        value={formatMMYYYYToMonthInput(scopingFrom)}
                                        onChange={(e) => setScopingFrom(formatMonthInputToMMYYYY(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Period of Market Scoping — To (mm/yyyy):</label>
                                    <input
                                        type="month"
                                        value={formatMMYYYYToMonthInput(scopingTo)}
                                        onChange={(e) => setScopingTo(formatMonthInputToMMYYYY(e.target.value))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    3. Market Scoping Activity/ies Conducted <span className="font-normal italic normal-case text-slate-600">(Check all that apply)</span>
                                </h3>
                                <p className="text-[11px] text-slate-600 mt-1">
                                    This confirms that market scoping activities were conducted in accordance with Section 10 of Republic Act No. 12009 and its Implementing Rules and Regulations (IRR), and considered in the Project Procurement Management Plan, consistent with the Principle of Proportionality.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-slate-300 text-xs">
                                    <thead className="bg-slate-100 text-slate-800 font-bold">
                                        <tr>
                                            <th className="border border-slate-300 p-2 w-16 text-center">Check (✓)</th>
                                            <th className="border border-slate-300 p-2 text-left w-[45%]">Activity/ies Conducted</th>
                                            <th className="border border-slate-300 p-2 text-left">Documentation (as may be applicable)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MARKET_SCOPING_ACTIVITIES.map((def) => {
                                            const row = activitiesState.find((a) => a.activity_code === def.code) || { is_checked: false, custom_activity_text: '', documentation_notes: '' };
                                            return (
                                                <tr
                                                    key={def.code}
                                                    className={`transition ${row.is_checked ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="border border-slate-300 p-2 text-center align-top">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(row.is_checked)}
                                                            onChange={() => toggleActivity(def.code)}
                                                            className="w-4 h-4 accent-blue-600 cursor-pointer mt-0.5"
                                                        />
                                                    </td>
                                                    <td className="border border-slate-300 p-2 align-top font-semibold text-slate-800">
                                                        <div>{def.activity}</div>
                                                        {def.isOther && (
                                                            <input
                                                                type="text"
                                                                value={row.custom_activity_text || ''}
                                                                onChange={(e) => {
                                                                    updateActivityField(def.code, 'custom_activity_text', e.target.value);
                                                                    if (e.target.value.trim() && !row.is_checked) {
                                                                        toggleActivity(def.code);
                                                                    }
                                                                }}
                                                                placeholder="Specify other market scoping activity..."
                                                                className="mt-2 w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="border border-slate-300 p-2 align-top text-slate-600 text-[11px] leading-relaxed">
                                                        {def.documentation && <div className="mb-1.5">{def.documentation}</div>}
                                                        {def.isOther && (
                                                            <input
                                                                type="text"
                                                                value={row.documentation_notes || ''}
                                                                onChange={(e) => updateActivityField(def.code, 'documentation_notes', e.target.value)}
                                                                placeholder="Supporting documentation for other activity..."
                                                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            />
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    4. Market Scoping Results
                                </h3>
                                <p className="text-[11px] text-slate-600 mt-1">
                                    Indicate recommendations in the column provided based on the results of the market scoping activities undertaken. These recommendations shall be considered in the development of a comprehensive and realistic PPMP, taking into account the parameters outlined under Section 10.4 of the IRR of RA 12009, as may be applicable.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-slate-300 text-xs">
                                    <thead className="bg-slate-100 text-slate-800 font-bold">
                                        <tr>
                                            <th className="border border-slate-300 p-2 text-left w-[30%]">Parameters</th>
                                            <th className="border border-slate-300 p-2 text-center w-[20%]">
                                                Considered?<br />
                                                <span className="font-normal italic text-[10px]">(Yes / No / Not Applicable)</span>
                                            </th>
                                            <th className="border border-slate-300 p-2 text-left">
                                                Recommendations based on the Market Scoping<br />
                                                <span className="font-normal italic text-[10px]">(Attach additional documents if necessary)</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MARKET_SCOPING_PARAMETERS.map((param) => {
                                            const row = resultsState.find((r) => r.parameter_code === param.code) || { considered: '', recommendations: '' };
                                            return (
                                                <tr key={param.code} className="hover:bg-slate-50/70">
                                                    <td className="border border-slate-300 p-2.5 align-top">
                                                        <div className="font-bold text-slate-900">
                                                            {param.letter} {param.title}
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 mt-0.5">{param.question}</div>
                                                    </td>
                                                    <td className="border border-slate-300 p-2.5 align-top">
                                                        <select
                                                            value={row.considered || ''}
                                                            onChange={(e) => updateResultField(param.code, 'considered', e.target.value)}
                                                            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                                        >
                                                            {CONSIDERED_OPTIONS.map((opt) => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="border border-slate-300 p-2.5 align-top space-y-1.5">
                                                        <select
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    updateResultField(param.code, 'recommendations', e.target.value);
                                                                }
                                                            }}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-[11px] bg-slate-50 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="">-- Quick-select standard recommendation (optional) --</option>
                                                            {param.presets.map((preset, i) => (
                                                                <option key={i} value={preset}>
                                                                    {preset}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <textarea
                                                            rows={2}
                                                            value={row.recommendations || ''}
                                                            onChange={(e) => updateResultField(param.code, 'recommendations', e.target.value)}
                                                            placeholder="Enter recommendation based on market scoping..."
                                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                Signatories
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                    <div className="font-bold text-slate-900">Prepared by: Personnel-in-Charge, End-User or Implementing Unit</div>
                                    <input
                                        type="text"
                                        value={preparedByName}
                                        onChange={(e) => setPreparedByName(e.target.value)}
                                        placeholder="Printed Name"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={preparedByPosition}
                                        onChange={(e) => setPreparedByPosition(e.target.value)}
                                        placeholder="Position / Designation"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                    <input
                                        type="date"
                                        value={preparedByDate}
                                        onChange={(e) => setPreparedByDate(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                </div>
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                    <div className="font-bold text-slate-900">Approved by: Head, End-User or Implementing Unit</div>
                                    <input
                                        type="text"
                                        value={approvedByName}
                                        onChange={(e) => setApprovedByName(e.target.value)}
                                        placeholder="Printed Name"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={approvedByPosition}
                                        onChange={(e) => setApprovedByPosition(e.target.value)}
                                        placeholder="Position / Designation"
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                    <input
                                        type="date"
                                        value={approvedByDate}
                                        onChange={(e) => setApprovedByDate(e.target.value)}
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={savedScoping ? () => setIsEditing(false) : onBack}
                                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save & View Official Market Scoping'}
                            </button>
                        </div>
                    </div>
                ) : (

                    <div
                        ref={sheetRef}
                        className="pdf-export-root attachment-sheet bg-white text-black font-bold p-6 sm:p-10 max-w-[820px] mx-auto shadow-xl rounded-2xl border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-none"
                    >

                        <div className="pdf-avoid-break">
                            <div className="flex items-center justify-center gap-4 mb-2 text-center">
                                <img
                                    src="/images/logo.png"
                                    alt="Provincial Seal"
                                    className="w-16 h-16 object-contain shrink-0"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold uppercase tracking-wide">Republic of the Philippines</div>
                                    <div className="text-base font-extrabold uppercase tracking-wide whitespace-nowrap">
                                        {procuringEntity || 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR'}
                                    </div>
                                    <div className="text-xs font-bold">Matti, Digos City</div>
                                </div>
                            </div>

                            <div className="text-center text-base font-extrabold uppercase tracking-wider pt-1 pb-2 border-b-2 border-blue-700 mb-4">
                                MARKET SCOPING CHECKLIST
                            </div>
                        </div>

                        <div className="mb-4 pdf-avoid-break">
                            <div className="text-xs font-extrabold uppercase mb-1.5">1. &nbsp;&nbsp; AGENCY INFORMATION</div>
                            <table className="w-full table-fixed border-collapse border-2 border-black text-xs font-bold">
                                <tbody>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 w-[42%] font-extrabold bg-slate-50">
                                            Name of Procuring Entity
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_procuring_entity', 'Market Scoping • Name of Procuring Entity', procuringEntity, setProcuringEntity)}
                                            className="border border-black px-2.5 py-1.5 font-bold uppercase break-words"
                                        >
                                            {procuringEntity || '—'}
                                        </CommentableCell>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 font-extrabold bg-slate-50">
                                            End-User/Implementing Unit
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_implementing_unit', 'Market Scoping • End-User/Implementing Unit', implementingUnit, setImplementingUnit)}
                                            className="border border-black px-2.5 py-1.5 font-bold uppercase break-words"
                                        >
                                            {implementingUnit || '—'}
                                        </CommentableCell>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 font-extrabold bg-slate-50">
                                            Name &amp; Designation of Representative
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_representative', 'Market Scoping • Name & Designation of Representative', representative, setRepresentative)}
                                            className="border border-black px-2.5 py-1.5 font-bold break-words"
                                        >
                                            {representative || '—'}
                                        </CommentableCell>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-4 pdf-avoid-break">
                            <div className="text-xs font-extrabold uppercase mb-1.5">2. &nbsp;&nbsp; PROJECT OVERVIEW</div>
                            <table className="w-full table-fixed border-collapse border-2 border-black text-xs font-bold">
                                <tbody>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 w-[42%] font-extrabold bg-slate-50">
                                            Project Name
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_project_name', 'Market Scoping • Project Name', projectName, setProjectName)}
                                            className="border border-black px-2.5 py-1.5 font-bold break-words"
                                        >
                                            {projectName || '—'}
                                        </CommentableCell>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 font-extrabold bg-slate-50">
                                            Estimated Budget
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_estimated_budget', 'Market Scoping • Estimated Budget', estimatedBudget, setEstimatedBudget)}
                                            className="border border-black px-2.5 py-1.5 tabular-nums font-extrabold break-words"
                                        >
                                            {formatCurrency(parseFloat(estimatedBudget) || 0)}
                                        </CommentableCell>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 font-extrabold bg-slate-50">
                                            Period of Market Scoping<br />
                                            <span className="font-bold">[From (mm/yyyy) To (mm/yyyy)]</span>
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_scoping_period', 'Market Scoping • Period of Market Scoping', scopingPeriodDisplay, (newVal) => {
                                                const parsed = parsePeriodValue(newVal);
                                                setScopingFrom(parsed.from);
                                                setScopingTo(parsed.to);
                                            })}
                                            className="border border-black px-2.5 py-1.5 font-bold"
                                        >
                                            {scopingPeriodDisplay}
                                        </CommentableCell>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2.5 py-1.5 font-extrabold bg-slate-50">
                                            Expected Date of Delivery <span className="italic">(mm/yyyy)</span>
                                        </td>
                                        <CommentableCell
                                            as="td"
                                            {...getCommentProps('ms_expected_delivery', 'Market Scoping • Expected Date of Delivery', expectedDelivery, setExpectedDelivery)}
                                            className="border border-black px-2.5 py-1.5 font-bold"
                                        >
                                            {expectedDelivery || '—'}
                                        </CommentableCell>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-4">
                            <div className="pdf-keep-with-next">
                                <div className="text-xs font-extrabold uppercase mb-1">
                                    3. &nbsp;&nbsp; MARKET SCOPING ACTIVITY/IES CONDUCTED <span className="italic normal-case font-bold">(Check all that apply)</span>
                                </div>
                                <p className="text-[11px] font-bold leading-snug mb-2 pl-5">
                                    This confirms that market scoping activities were conducted in accordance with Section 10 of Republic Act No. 12009 and its Implementing Rules and Regulations (IRR), and considered in the Project Procurement Management Plan, consistent with the Principle of Proportionality.
                                </p>
                            </div>
                            <table className="w-full table-fixed border-collapse border-2 border-black text-xs font-bold">
                                <thead>
                                    <tr className="bg-slate-100 text-center font-extrabold border-b-2 border-black">
                                        <th className="border border-black px-1.5 py-2 w-[11%]">Check<br />(✓)</th>
                                        <th className="border border-black px-2 py-2 w-[45%]">Activity/ies Conducted</th>
                                        <th className="border border-black px-2 py-2 w-[44%]">
                                            Documentation<br />
                                            <span className="font-bold text-[10px]">(as may be applicable)</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MARKET_SCOPING_ACTIVITIES.map((def) => {
                                        const row = activitiesState.find((a) => a.activity_code === def.code) || { is_checked: false, custom_activity_text: '', documentation_notes: '' };
                                        return (
                                            <tr key={def.code}>
                                                <CommentableCell
                                                    as="td"
                                                    {...getCommentProps(
                                                        `ms_activity_${def.code}`,
                                                        `Market Scoping Activity • ${def.activity}`,
                                                        row.is_checked ? 'Checked' : 'Unchecked',
                                                        (val) => setActivityChecked(def.code, val)
                                                    )}
                                                    className="border border-black px-2 py-2 text-center align-top"
                                                >
                                                    <span className={`inline-flex items-center justify-center w-4 h-4 border-2 border-black text-xs leading-none ${row.is_checked ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                                        {row.is_checked ? '✓' : ''}
                                                    </span>
                                                </CommentableCell>
                                                <td className="border border-black px-2 py-2 align-top break-words leading-snug">
                                                    <div>{def.activity}</div>
                                                    {def.isOther && (
                                                        <div className="mt-1.5 border-b border-black pb-0.5 min-h-[18px]">
                                                            {row.custom_activity_text || ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-black px-2 py-2 align-top text-[11px] break-words leading-snug">
                                                    {row.documentation_notes || def.documentation || ''}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="mt-2 text-[11px] italic font-bold space-y-1 pl-2 pdf-avoid-break">
                                <div>Notes:</div>
                                <div className="pl-4">i. &nbsp; The market scoping activities shall be identified and undertaken at the option of the End-User or Implementing Unit based on its needs and objectives.</div>
                                <div className="pl-4">ii. &nbsp; The list of supporting documents in the Documentation column is not exclusive and may include other documents that may be gathered by the End-User or Implementing Unit pertinent to the activity/ies conducted.</div>
                            </div>
                        </div>

                        <div className="mb-5">
                            <div className="pdf-keep-with-next">
                                <div className="text-xs font-extrabold uppercase mb-1">
                                    4. &nbsp;&nbsp; MARKET SCOPING RESULTS
                                </div>
                                <p className="text-[11px] font-bold leading-snug mb-2 pl-5">
                                    Indicate recommendations in the column provided based on the results of the market scoping activities undertaken. These recommendations shall be considered in the development of a comprehensive and realistic PPMP, taking into account the parameters outlined under Section 10.4 of the IRR of RA 12009, as may be applicable.
                                </p>
                            </div>
                            <table className="w-full table-fixed border-collapse border-2 border-black text-xs font-bold">
                                <thead>
                                    <tr className="bg-slate-100 text-center font-extrabold border-b-2 border-black">
                                        <th className="border border-black px-2 py-2 w-[34%]">Parameters</th>
                                        <th className="border border-black px-2 py-2 w-[18%]">
                                            Considered?<br />
                                            <span className="italic font-bold text-[10px]">(Yes/No/ Not Applicable)</span>
                                        </th>
                                        <th className="border border-black px-2 py-2 w-[48%]">
                                            Recommendations<br />
                                            based on the Market Scoping<br />
                                            <span className="italic font-bold text-[10px]">(Attach additional documents if necessary)</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MARKET_SCOPING_PARAMETERS.map((param) => {
                                        const row = resultsState.find((r) => r.parameter_code === param.code) || { considered: '', recommendations: '' };
                                        return (
                                            <tr key={param.code}>
                                                <td className="border border-black px-2 py-2 align-top leading-snug break-words">
                                                    <div className="font-extrabold">
                                                        {param.letter} &nbsp; {param.title}
                                                    </div>
                                                    <div className="text-[11px] font-bold pl-4 mt-0.5">{param.question}</div>
                                                </td>
                                                <CommentableCell
                                                    as="td"
                                                    {...getCommentProps(
                                                        `ms_result_${param.code}_considered`,
                                                        `Market Scoping • ${param.title} (Considered?)`,
                                                        row.considered,
                                                        (val) => updateResultField(param.code, 'considered', val)
                                                    )}
                                                    className="border border-black px-2 py-2 text-center align-top font-extrabold"
                                                >
                                                    {row.considered || '—'}
                                                </CommentableCell>
                                                <CommentableCell
                                                    as="td"
                                                    {...getCommentProps(
                                                        `ms_result_${param.code}_recommendations`,
                                                        `Market Scoping • ${param.title} (Recommendations)`,
                                                        row.recommendations,
                                                        (val) => updateResultField(param.code, 'recommendations', val)
                                                    )}
                                                    className="border border-black px-2 py-2 align-top whitespace-pre-wrap break-words leading-snug"
                                                >
                                                    {row.recommendations || ''}
                                                </CommentableCell>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-8 text-xs font-bold print-signature-box">
                            <div>
                                <div className="font-bold">Prepared by:</div>
                                <div className="font-extrabold leading-snug mb-3">
                                    Personnel-in-Charge, End-User or Implementing Unit
                                </div>
                                <div className="flex flex-col items-start">
                                    {isSignatureEnabled && preparedSig?.user?.signature_path ? (
                                        <>
                                            <div className={`h-8 flex items-center ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${encodeURIComponent(preparedSig.user.encrypted_id)}/signature`}
                                                    alt="Prepared By Signature"
                                                    className="max-h-8 max-w-[120px] object-contain"
                                                />
                                            </div>
                                            {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                        </>
                                    ) : (
                                        <div className="h-6" />
                                    )}
                                    <div className="font-extrabold text-sm uppercase underline whitespace-nowrap">
                                        {preparedByName || defaultRepName || '[Signature over Printed Name]'}
                                    </div>
                                    <div className="text-xs font-bold whitespace-nowrap mt-0.5">
                                        {preparedByPosition || defaultRepDesignation || '[Position/Designation]'}
                                    </div>
                                    <div className="text-xs font-bold mt-0.5">
                                        Date: {preparedByDate || '________________'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="font-bold">Approved by:</div>
                                <div className="font-extrabold leading-snug mb-3">
                                    Head, End-User or Implementing Unit
                                </div>
                                <div className="flex flex-col items-start">
                                    {isSignatureEnabled && submittedByUser?.signature_path ? (
                                        <>
                                            <div className={`h-8 flex items-center ${!isHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${encodeURIComponent(submittedByUser.encrypted_id)}/signature`}
                                                    alt="Approved By Signature"
                                                    className="max-h-8 max-w-[120px] object-contain"
                                                />
                                            </div>
                                            {!isHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                        </>
                                    ) : (
                                        <div className="h-6" />
                                    )}
                                    <div className="font-extrabold text-sm uppercase underline whitespace-nowrap">
                                        {approvedByName || defaultHeadName || '[Signature over Printed Name]'}
                                    </div>
                                    <div className="text-xs font-bold whitespace-nowrap mt-0.5">
                                        {approvedByPosition || defaultHeadPosition || '[Position/Designation]'}
                                    </div>
                                    <div className="text-xs font-bold mt-0.5">
                                        Date: {approvedByDate || (ppmp?.head_approved_at ? formatDate(ppmp.head_approved_at) : '________________')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PPMPMarketScopingView;
