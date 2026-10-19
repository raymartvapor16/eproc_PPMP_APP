import React, { useState } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { Printer, ArrowLeft, Plus, Trash2, Edit3, Loader2, Sparkles, ShieldCheck, History, X, Eye } from 'lucide-react';
import { ppmpService } from '../../services/api';
import { formatDescription6Words, formatMonthYear, toMonthInputValue, MonthRangeInput } from './ProcurementPlanTable';
import { useSignatureSettings } from '../../utils/signatureController';

/**
 * APPPrintView:
 * Annual Procurement Plan (APP) Form & Print View matching Davao del Sur standard template.
 * Header: Republic of the Philippines, PROVINCE OF DAVAO DEL SUR, ANNUAL PROCUREMENT PLAN FOR CY [Year]
 * Checkboxes: INDICATIVE / FINAL / UPDATED VERSION NO. [___]
 * Columns (11 Columns):
 *  1. Project Title
 *  2. End-User or Implementing Unit
 *  3. General Description of the Project
 *  4. Mode of Procurement
 *  5. To be covered by an Early Procurement Activity? (YES/NO)
 *  6. Criteria for Bid Evaluation (Including Sustainability and Domestic Preference) [default: LCRB]
 *  7. Start of Procurement Activity (Projected Timeline MM/YYYY)
 *  8. End of Procurement Activity (Projected Timeline MM/YYYY)
 *  9. Source of Fund (Funding Details)
 * 10. Estimated Budget / Approved Budget for the Contract (PhP)
 * 11. PROCUREMENT STRATEGY OR TOOLS / REMARKS (Other relevant descriptions)
 *
 * Signatures:
 *  - Prepared & Reviewed By: (Name & Designation based on PPMP data)
 *  - Recommending Approval: (Name & Designation based on PPMP data / BAC Secretariat / Head)
 *  - Approved by: (this is for governor) Name & Designation
 */
export const APPPrintView = ({ ppmp, user, canEdit = true, onBack, onGenerated }) => {
    const { isEnabled } = useSignatureSettings();
    const isAppSignatureEnabled = ppmp?.signature_settings?.app !== undefined
        ? Boolean(ppmp.signature_settings.app)
        : isEnabled('app');

    const savedData = ppmp?.app_data || null;

    const isTwgDone = Boolean(ppmp?.twg_approved_at || ppmp?.signatures?.some(s => s.role === 'twg'));
    const isOppmoAuthorized = (user?.role === 'oppmo' && isTwgDone);
    const allowEdit = canEdit && (isOppmoAuthorized || ['admin', 'super_admin'].includes(user?.role));

    const [isEditing, setIsEditing] = useState(!savedData && allowEdit);
    const [saving, setSaving] = useState(false);

    // Form states
    const [fiscalYear, setFiscalYear] = useState(
        savedData?.fiscal_year || ppmp?.fiscal_year || new Date().getFullYear().toString()
    );
    const [planVersionType, setPlanVersionType] = useState(
        savedData?.plan_version_type || ppmp?.plan_type || 'FINAL'
    );
    const [updatedVersionNo, setUpdatedVersionNo] = useState(
        savedData?.updated_version_no || ''
    );

    const signatures = ppmp?.signatures || [];

    // If scope is ATTACHMENT_LIST only, PPMP / APP were NOT changed and retain approved baseline signatures from parent.
    // If scope is PPMP_APP, ALL, or initial plan: PPMP / APP ARE being changed, so budget & oppmo reviewer signatures MUST BE NONE until they approve this child PPMP!
    const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';

    // Reviewer signatures require review approval before their initial/signature is valid
    const hasHeadApproved = Boolean(
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
    );
    const hasTwgApproved = Boolean(
        ppmp?.twg_approved_at ||
        ['HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ['TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );

    const preparedSig = signatures.find(s => s.role === 'end_user')
        || (ppmp?.parent?.signatures?.find(s => s.role === 'end_user'))
        || null;
    const headSig = hasHeadApproved
        ? (signatures.find(s => s.role === 'head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'head') : null))
        : null;

    const budgetSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'budget_officer') || ppmp?.parent?.signatures?.find(s => s.role === 'budget_officer') || null)
        : (hasBudgetApproved ? signatures.find(s => s.role === 'budget_officer') : null);

    const oppmoSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'oppmo') || ppmp?.parent?.signatures?.find(s => s.role === 'oppmo') || null)
        : (hasOppmoApproved ? signatures.find(s => s.role === 'oppmo') : null);

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    // Database active signatories (live from database ppmp_signatories table via default_signatories)
    const dbAppPrepared = ppmp?.default_signatories?.app_prepared_by;
    const dbAppReviewed = ppmp?.default_signatories?.app_reviewed_by || ppmp?.default_signatories?.bac_secretariat;
    const dbAppRecommending = ppmp?.default_signatories?.app_recommending || ppmp?.default_signatories?.budget_requirement;
    const dbAppApproved = ppmp?.default_signatories?.app_approved_by || ppmp?.default_signatories?.approved_by;

    // Check if savedData has legacy preparer (Norjanna was previously saved as prepared_by before Gina was introduced)
    const isLegacyNorjannaPreparer = Boolean(
        (
            savedData?.prepared_by_name === 'NORJANNA M. CAMAGUIN, MPA' ||
            (dbAppReviewed?.name && savedData?.prepared_by_name === dbAppReviewed.name)
        ) && (!savedData?.reviewed_by_name || savedData?.reviewed_by_name === savedData?.prepared_by_name)
    );

    // APP Signers:
    // Prepared By: must be GINA MAE B. CARBAQUEL based on the database
    const [preparedByName, setPreparedByName] = useState(
        isLegacyNorjannaPreparer
            ? (dbAppPrepared?.name || 'GINA MAE B. CARBAQUEL')
            : (savedData?.prepared_by_name || dbAppPrepared?.name || 'GINA MAE B. CARBAQUEL')
    );
    const [preparedByPosition, setPreparedByPosition] = useState(
        isLegacyNorjannaPreparer
            ? (dbAppPrepared?.position || 'ADAS II')
            : (savedData?.prepared_by_position || dbAppPrepared?.position || 'ADAS II')
    );

    // Reviewed By: NORJANNA M. CAMAGUIN, MPA (PGDH - OPPMO)
    const [reviewedByName, setReviewedByName] = useState(
        savedData?.reviewed_by_name ||
        dbAppReviewed?.name ||
        'NORJANNA M. CAMAGUIN, MPA'
    );
    const [reviewedByPosition, setReviewedByPosition] = useState(
        savedData?.reviewed_by_position ||
        dbAppReviewed?.position ||
        'PGDH - OPPMO'
    );

    // Recommending Approval: DESSAMIE BUAT-SANCHEZ, CPA, JD (PGDH - PBO / BAC - Chairman)
    const [recommendingName, setRecommendingName] = useState(
        savedData?.recommending_name ||
        ppmp?.default_signatories?.app_recommending?.name ||
        ppmp?.default_signatories?.budget_requirement?.name ||
        'DESSAMIE BUAT-SANCHEZ, CPA, JD'
    );
    const [recommendingPosition, setRecommendingPosition] = useState(
        savedData?.recommending_position ||
        ppmp?.default_signatories?.app_recommending?.position ||
        ppmp?.default_signatories?.budget_requirement?.position ||
        'PGDH - PBO / BAC - Chairman'
    );

    // Approved by: Governor
    const [approvedByName, setApprovedByName] = useState(
        savedData?.approved_by_name ||
        ppmp?.default_signatories?.app_approved_by?.name ||
        ppmp?.default_signatories?.approved_by?.name ||
        'HON. YVONNE R. CAGAS'
    );
    const [approvedByPosition, setApprovedByPosition] = useState(
        savedData?.approved_by_position ||
        ppmp?.default_signatories?.app_approved_by?.position ||
        ppmp?.default_signatories?.approved_by?.position ||
        'PROVINCIAL GOVERNOR'
    );

    // Helper to resolve Type of Project to be Procured (Goods, Infrastructure Projects, Consulting Services)
    const resolveProjectType = (item, ppmpData) => {
        const raw = item?.project_type || ppmpData?.items?.find(i => !i.is_header && i.project_type)?.project_type || ppmpData?.project_type || 'Goods';
        const trimmed = String(raw).trim();
        const lower = trimmed.toLowerCase();
        if (lower.includes('infra')) {
            return 'Infrastructure Projects';
        }
        if (lower.includes('consult')) {
            return 'Consulting Services';
        }
        if (lower.includes('good') || trimmed !== '') {
            return trimmed || 'Goods';
        }
        return 'Goods';
    };

    // Initial rows based on PPMP items or existing saved data
    const [rows, setRows] = useState(() => {
        const items = ppmp?.items || [];
        const nonHeaderItems = items.filter(i => !i.is_header);

        const defaultEndUser = (ppmp?.program_name && String(ppmp.program_name).trim() !== '')
            ? String(ppmp.program_name).trim()
            : (ppmp?.implementing_unit || ppmp?.office?.name || 'Implementing Unit');

        if (savedData?.rows && Array.isArray(savedData.rows) && savedData.rows.length > 0) {
            return savedData.rows.map((row, idx) => {
                const matchingItem = nonHeaderItems[idx] || nonHeaderItems.find(i => (i.id && i.id === row.id) || (i.description && i.description === row.projectTitle));
                const expectedType = resolveProjectType(matchingItem, ppmp);

                const currentValLower = String(row.generalDescription || '').trim().toLowerCase();
                const isKnownType = ['goods', 'infrastructure', 'infrastructure projects', 'consulting', 'consulting services']
                    .includes(currentValLower);

                // If generalDescription is empty, was previously the item description / ppmp title, or is not a recognized project type:
                if (!isKnownType) {
                    return {
                        ...row,
                        generalDescription: expectedType,
                    };
                }

                return row;
            });
        }

        if (nonHeaderItems.length > 0) {
            return nonHeaderItems.map((item, idx) => ({
                id: item.id || idx + 1,
                projectTitle: ppmp?.account_code ? `${ppmp.account_code}\n${item.description}` : item.description,
                endUser: defaultEndUser,
                generalDescription: resolveProjectType(item, ppmp),
                modeOfProcurement: item.procurement_mode || 'Public Bidding',
                earlyProcurement: item.pre_proc_conference ? 'YES' : 'NO',
                criteria: 'LCRB',
                startDate: item.start_date ? formatMonthYear(item.start_date) : '',
                endDate: item.end_date ? formatMonthYear(item.end_date) : '',
                sourceOfFund: item.source_of_fund || 'General Fund',
                estimatedBudget: item.estimated_budget || 0,
                procurementStrategy: item.remarks || '',
            }));
        }

        return [
            {
                id: 1,
                projectTitle: ppmp?.account_code || 'General Requirements',
                endUser: defaultEndUser,
                generalDescription: resolveProjectType(null, ppmp),
                modeOfProcurement: 'Public Bidding',
                earlyProcurement: 'NO',
                criteria: 'LCRB',
                startDate: '',
                endDate: '',
                sourceOfFund: 'General Fund',
                estimatedBudget: ppmp?.total_budget || 0,
                procurementStrategy: '',
            }
        ];
    });

    const handleUpdateRow = (index, field, value) => {
        const updated = [...rows];
        updated[index] = { ...updated[index], [field]: value };
        setRows(updated);
    };

    const handleAddRow = () => {
        const defaultEndUser = (ppmp?.program_name && String(ppmp.program_name).trim() !== '')
            ? String(ppmp.program_name).trim()
            : (ppmp?.implementing_unit || ppmp?.office?.name || '');

        setRows([
            ...rows,
            {
                id: Date.now(),
                projectTitle: '',
                endUser: defaultEndUser,
                generalDescription: resolveProjectType(null, ppmp),
                modeOfProcurement: 'Public Bidding',
                earlyProcurement: 'NO',
                criteria: 'LCRB',
                startDate: '',
                endDate: '',
                sourceOfFund: 'General Fund',
                estimatedBudget: '',
                procurementStrategy: '',
            }
        ]);
    };

    const handleRemoveRow = (index) => {
        if (rows.length <= 1) {
            alert('At least one row is required in the APP.');
            return;
        }
        setRows(rows.filter((_, idx) => idx !== index));
    };

    const handleGenerate = async () => {
        const payload = {
            fiscal_year: fiscalYear,
            plan_version_type: planVersionType,
            updated_version_no: updatedVersionNo,
            prepared_by_name: preparedByName,
            prepared_by_position: preparedByPosition,
            reviewed_by_name: reviewedByName,
            reviewed_by_position: reviewedByPosition,
            recommending_name: recommendingName,
            recommending_position: recommendingPosition,
            approved_by_name: approvedByName,
            approved_by_position: approvedByPosition,
            rows,
        };

        setSaving(true);
        try {
            if (ppmp?.uuid) {
                const res = await ppmpService.saveAppData(ppmp.uuid, payload);
                localStorage.setItem(`ppmp_app_${ppmp.uuid}`, JSON.stringify(rows));
                localStorage.setItem(`ppmp_app_generated_${ppmp.uuid}`, 'true');
                setIsEditing(false);
                if (onGenerated) onGenerated(res.data.ppmp);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save APP.');
        } finally {
            setSaving(false);
        }
    };

    const isReadyToPrint = ppmp?.status === 'READY_TO_PRINT' || !canEdit;

    const handlePrint = () => {
        if (!isReadyToPrint) {
            alert('Printing is only authorized once the PPMP has reached the READY TO PRINT status after full workflow approval.');
            return;
        }
        window.print();
    };

    const totalAppBudget = rows.reduce((sum, r) => sum + (parseFloat(r.estimatedBudget) || 0), 0);

    return (
        <div className="bg-white min-h-screen font-sans text-black">
            {/* Top Toolbar (Hidden when printing) */}
            <div className="no-print bg-slate-900 text-white px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700 transition cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Workspace
                    </button>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            <span>Annual Procurement Plan (APP) — Province of Davao del Sur</span>
                            {!canEdit && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-900 text-indigo-200 border border-indigo-700">
                                    Baseline / Old APP
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-blue-400 font-mono">
                            {isEditing ? 'Configuring / Edit Mode' : 'Official Clean Printable View (CY ' + fiscalYear + ')'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">

                    {allowEdit && !isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-semibold border border-slate-700 transition cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            Customize APP
                        </button>
                    )}

                    {!isEditing ? (
                        isReadyToPrint ? (
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                PRINT APP NOW
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="flex items-center gap-2 px-5 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider rounded cursor-not-allowed opacity-60"
                                title="Printing is disabled. PPMP must reach READY TO PRINT status."
                            >
                                <Printer className="w-4 h-4" />
                                PRINT APP (LOCKED)
                            </button>
                        )
                    ) : (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleGenerate}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition cursor-pointer disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Save & View Printable APP
                        </button>
                    )}
                </div>
            </div>

            {/* Container */}
            <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
                {isEditing ? (
                    /* EDIT / CUSTOMIZE FORM MODE */
                    <div className="space-y-6">
                        {/* Configuration header */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                APP Header & Version Configuration
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Fiscal Year (CY):</label>
                                    <input
                                        type="text"
                                        value={fiscalYear || ''}
                                        onChange={(e) => setFiscalYear(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                        placeholder="e.g. 2026"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Plan Version Type:</label>
                                    <select
                                        value={planVersionType || 'INDICATIVE'}
                                        onChange={(e) => setPlanVersionType(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                                    >
                                        <option value="INDICATIVE">INDICATIVE</option>
                                        <option value="FINAL">FINAL</option>
                                        <option value="UPDATED">UPDATED</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Updated Version No. (if updated):</label>
                                    <input
                                        type="text"
                                        value={updatedVersionNo || ''}
                                        onChange={(e) => setUpdatedVersionNo(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                                        placeholder="e.g. 01, 02"
                                    />
                                </div>
                            </div>
                        </div>
                    
                        {/* Signatories Configuration Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                Signatories Configuration
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                {/* Prepared By */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                    <span className="font-bold text-slate-900 block uppercase">Prepared By:</span>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Name</label>
                                        <input
                                            type="text"
                                            value={preparedByName || ''}
                                            onChange={(e) => setPreparedByName(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs uppercase font-semibold"
                                            placeholder="GINA MAE B. CARBAQUEL"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Designation</label>
                                        <input
                                            type="text"
                                            value={preparedByPosition || ''}
                                            onChange={(e) => setPreparedByPosition(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                            placeholder="ADAS II"
                                        />
                                    </div>
                                </div>

                                {/* Reviewed By */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                    <span className="font-bold text-slate-900 block uppercase">Reviewed By:</span>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Name</label>
                                        <input
                                            type="text"
                                            value={reviewedByName || ''}
                                            onChange={(e) => setReviewedByName(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs uppercase font-semibold"
                                            placeholder="NORJANNA M. CAMAGUIN, MPA"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Designation</label>
                                        <input
                                            type="text"
                                            value={reviewedByPosition || ''}
                                            onChange={(e) => setReviewedByPosition(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                            placeholder="PGDH - OPPMO"
                                        />
                                    </div>
                                </div>

                                {/* Recommending Approval */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                    <span className="font-bold text-slate-900 block uppercase">Recommending Approval:</span>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Name</label>
                                        <input
                                            type="text"
                                            value={recommendingName || ''}
                                            onChange={(e) => setRecommendingName(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs uppercase font-semibold"
                                            placeholder="DESSAMIE BUAT-SANCHEZ, CPA, JD"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Designation</label>
                                        <input
                                            type="text"
                                            value={recommendingPosition || ''}
                                            onChange={(e) => setRecommendingPosition(e.target.value)}
                                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                                            placeholder="PGDH - PBO / BAC - Chairman"
                                        />
                                    </div>
                                </div>

                                {/* Approved by: Governor */}
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                                    <span className="font-bold text-emerald-900 block uppercase flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                        Approved by: (Governor)
                                    </span>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Governor Name</label>
                                        <input
                                            type="text"
                                            value={approvedByName || ''}
                                            onChange={(e) => setApprovedByName(e.target.value)}
                                            className="w-full px-2 py-1 border border-emerald-300 rounded text-xs uppercase font-bold text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block">Official Designation</label>
                                        <input
                                            type="text"
                                            value={approvedByPosition || ''}
                                            onChange={(e) => setApprovedByPosition(e.target.value)}
                                            className="w-full px-2 py-1 border border-emerald-300 rounded text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Project Details Table in Form */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                        Annual Procurement Plan Items & Details
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Pre-filled from PPMP data. Edit any row or add more projects as needed.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Project Row
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-slate-200 text-xs">
                                    <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="border border-slate-300 p-2 text-left min-w-[240px]">Project Title</th>
                                            <th className="border border-slate-300 p-2 text-left w-28">End-User / Unit</th>
                                            <th className="border border-slate-300 p-2 text-left w-36">General Description of the Project</th>
                                            <th className="border border-slate-300 p-2 text-left">Mode of Procurement</th>
                                            <th className="border border-slate-300 p-2 w-16">Early Proc?</th>
                                            <th className="border border-slate-300 p-2 w-20">Evaluation Criteria</th>
                                            <th className="border border-slate-300 p-2 w-24">Start (MM/YYYY)</th>
                                            <th className="border border-slate-300 p-2 w-24">End (MM/YYYY)</th>
                                            <th className="border border-slate-300 p-2 text-left">Source of Fund</th>
                                            <th className="border border-slate-300 p-2 w-28 text-right">Estimated Budget</th>
                                            <th className="border border-slate-300 p-2 text-left">Strategy / Remarks</th>
                                            <th className="border border-slate-300 p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
                                            <tr key={row.id || idx} className="hover:bg-slate-50">
                                                <td className="border border-slate-200 p-1">
                                                    <textarea
                                                        rows={2}
                                                        value={row.projectTitle || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'projectTitle', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="text"
                                                        value={row.endUser || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'endUser', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <select
                                                        value={
                                                            row.generalDescription === 'Infrastructure'
                                                                ? 'Infrastructure Projects'
                                                                : (row.generalDescription || 'Goods')
                                                        }
                                                        onChange={(e) => handleUpdateRow(idx, 'generalDescription', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs bg-white font-medium"
                                                    >
                                                        <option value="Goods">Goods</option>
                                                        <option value="Infrastructure Projects">Infrastructure Projects</option>
                                                        <option value="Consulting Services">Consulting Services</option>
                                                        {!['Goods', 'Infrastructure Projects', 'Infrastructure', 'Consulting Services'].includes(row.generalDescription) && row.generalDescription && (
                                                            <option value={row.generalDescription}>{row.generalDescription}</option>
                                                        )}
                                                    </select>
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="text"
                                                        value={row.modeOfProcurement || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'modeOfProcurement', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1 text-center">
                                                    <select
                                                        value={row.earlyProcurement || 'NO'}
                                                        onChange={(e) => handleUpdateRow(idx, 'earlyProcurement', e.target.value)}
                                                        className="p-1 border border-slate-200 rounded text-xs bg-white"
                                                    >
                                                        <option value="NO">NO</option>
                                                        <option value="YES">YES</option>
                                                    </select>
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="text"
                                                        value={row.criteria || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'criteria', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs text-center font-bold"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1 align-top">
                                                    <MonthRangeInput
                                                        value={row.startDate}
                                                        onChange={(val) => handleUpdateRow(idx, 'startDate', val)}
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1 align-top">
                                                    <MonthRangeInput
                                                        value={row.endDate}
                                                        onChange={(val) => handleUpdateRow(idx, 'endDate', val)}
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="text"
                                                        value={row.sourceOfFund || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'sourceOfFund', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={row.estimatedBudget ?? ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'estimatedBudget', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs text-right font-mono"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <input
                                                        type="text"
                                                        value={row.procurementStrategy || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'procurementStrategy', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRow(idx)}
                                                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                                        title="Remove row"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                            <td colSpan={9} className="p-2 text-right uppercase">
                                                Total Estimated Budget:
                                            </td>
                                            <td className="p-2 text-right font-mono text-blue-900">
                                                {formatCurrency(totalAppBudget)}
                                            </td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onBack}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleGenerate}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Generate & View Official APP'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* OFFICIAL PRINT VIEW MATCHING DAVAO DEL SUR PDF TEMPLATE */
                    <div className="bg-white text-black p-4 sm:p-6 print:p-0 print:max-w-none">
                        {/* Header matching PDF */}
                        <div className="flex flex-col items-center justify-center text-center relative mb-4">
                            <img
                                src="/images/logo.png"
                                alt="Province of Davao del Sur Seal"
                                className="w-16 h-16 object-contain mb-1"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="text-[11px] uppercase tracking-wide">Republic of the Philippines</div>
                            <div className="text-xs font-extrabold uppercase tracking-wider">PROVINCE OF DAVAO DEL SUR</div>
                            <div className="text-xs font-extrabold uppercase tracking-wider mt-0.5">
                                ANNUAL PROCUREMENT PLAN FOR CY {fiscalYear}
                            </div>

                            {/* Checkboxes row matching PDF */}
                            <div className="flex items-center justify-center gap-8 text-[11px] font-bold mt-2">
                                <label className="flex items-center gap-1.5 cursor-default">
                                    <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${planVersionType === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'INDICATIVE' ? '✓' : ''}
                                    </span>
                                    <span>INDICATIVE</span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-default">
                                    <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${planVersionType === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'FINAL' ? '✓' : ''}
                                    </span>
                                    <span>FINAL</span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-default">
                                    <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${planVersionType === 'UPDATED' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'UPDATED' ? '✓' : ''}
                                    </span>
                                    <span>UPDATED VERSION NO. {updatedVersionNo || ''}</span>
                                </label>
                            </div>
                        </div>

                        {/* Exact 11-column APP Table */}
                        <table className="w-full border-collapse border border-black text-[9px] leading-tight print-table">
                            <thead>
                                {/* Top Category Header Row */}
                                <tr className="text-center font-bold border-b border-black">
                                    <th colSpan={6} className="border border-black p-1 uppercase">
                                        PROCUREMENT PROJECT DETAILS
                                    </th>
                                    <th colSpan={2} className="border border-black p-1 uppercase">
                                        PROJECTED TIMELINE (MM/YYYY)
                                    </th>
                                    <th colSpan={2} className="border border-black p-1 uppercase">
                                        FUNDING DETAILS
                                    </th>
                                    <th rowSpan={2} className="border border-black p-1 w-[10%] align-middle uppercase">
                                        REMARKS<br />
                                        <span className="font-normal text-[8px] normal-case">(Other relevant descriptions of the procurement project, if applicable)</span>
                                    </th>
                                </tr>

                                {/* Detailed Column Headers */}
                                <tr className="text-center font-bold border-b border-black">
                                    <th className="border border-black p-1 w-[22%]">Project Title</th>
                                    <th className="border border-black p-1 w-[8%]">End-User or Implementing Unit</th>
                                    <th className="border border-black p-1 w-[7%]">General Description of the Project</th>
                                    <th className="border border-black p-1 w-[9%]">Mode of Procurement</th>
                                    <th className="border border-black p-1 w-[6%]">To be covered by an Early Procurement Activity? (YES/NO)</th>
                                    <th className="border border-black p-1 w-[8%]">Criteria for Bid Evaluation (Including Sustainability and Domestic Preference)</th>
                                    <th className="border border-black p-1 w-[6%]">Start of Procurement Activity</th>
                                    <th className="border border-black p-1 w-[6%]">End of Procurement Activity</th>
                                    <th className="border border-black p-1 w-[8%]">Source of Fund</th>
                                    <th className="border border-black p-1 w-[10%]">Estimated Budget / Approved Budget for the Contract (PhP)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={idx} className="min-h-6">
                                        <td className="border border-black px-1.5 py-1 align-top text-center font-bold whitespace-pre-wrap">
                                            {formatDescription6Words(row.projectTitle)}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center uppercase">
                                            {row.endUser}
                                        </td>
                                        <td className="border border-black px-1.5 py-1 align-top text-center whitespace-pre-wrap">
                                            {formatDescription6Words(row.generalDescription)}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center">
                                            {row.modeOfProcurement}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center font-bold">
                                            {row.earlyProcurement}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center font-bold">
                                            {row.criteria || 'LCRB'}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center">
                                            {row.startDate ? formatMonthYear(row.startDate) : '—'}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center">
                                            {row.endDate ? formatMonthYear(row.endDate) : '—'}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center">
                                            {row.sourceOfFund}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-right font-mono font-bold">
                                            {row.estimatedBudget ? formatCurrency(row.estimatedBudget) : '—'}
                                        </td>
                                        <td className="border border-black px-1 py-1 align-top text-center">
                                            {row.procurementStrategy}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black font-bold">
                                    <td colSpan={9} className="border border-black p-1.5 text-right uppercase">
                                        Total Estimated Budget:
                                    </td>
                                    <td className="border border-black p-1.5 text-right font-mono font-bold">
                                        {formatCurrency(totalAppBudget)}
                                    </td>
                                    <td className="border border-black"></td>
                                </tr>
                            </tfoot>
                        </table>
                        <br />
                        {/* Signatures Section matching exact PDF Layout - balanced spacing & borderless */}
                        <div className="mt-6 text-black text-[9px] px-2">
                            <div className="grid grid-cols-4 gap-4 items-start">
                                {/* Column 1: Prepared by */}
                                <div>
                                    <div className="font-bold mb-2 text-left">Prepared by:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-bold text-xs uppercase underline text-center">
                                                {preparedByName}
                                            </div>
                                        </div>
                                        <div className="text-[9px] uppercase mt-0.5">
                                            {preparedByPosition}
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Reviewed by */}
                                <div>
                                    <div className="font-bold mb-2 text-left">Reviewed by:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-bold text-xs uppercase underline text-center">
                                                {reviewedByName}
                                            </div>
                                            {isAppSignatureEnabled && oppmoSig && oppmoSig.user?.signature_path && (
                                                <img
                                                    src={`/api/users/${oppmoSig.user.id}/signature`}
                                                    alt="Signature"
                                                    className="h-6 max-w-[60px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none"
                                                />
                                            )}
                                        </div>
                                        <div className="text-[9px] uppercase mt-0.5">
                                            {reviewedByPosition}
                                        </div>
                                    </div>
                                </div>

                                {/* Column 3: Recommending Approval */}
                                <div>
                                    <div className="font-bold mb-2 text-left">Recommending Approval:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-bold text-xs uppercase underline text-center">
                                                {recommendingName}
                                            </div>
                                            {isAppSignatureEnabled && budgetSig && budgetSig.user?.signature_path && (
                                                <img
                                                    src={`/api/users/${budgetSig.user.id}/signature`}
                                                    alt="Signature"
                                                    className="h-6 max-w-[60px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none"
                                                />
                                            )}
                                        </div>
                                        <div className="text-[9px] uppercase mt-0.5 font-bold">
                                            {recommendingPosition}
                                        </div>
                                    </div>
                                </div>

                                {/* Column 4: Approved by: (this is for governor) */}
                                <div>
                                    <div className="font-bold mb-2 text-left">
                                        Approved by:
                                    </div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        <div className="font-bold text-xs uppercase underline text-center">
                                            {approvedByName}
                                        </div>
                                        <div className="text-[9px] uppercase mt-0.5 font-bold">
                                            {approvedByPosition}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* System Generated / E-Signature Validity Notice */}
                            {isAppSignatureEnabled && (
                                <div className="mt-4 pt-2 border-t border-dotted border-slate-300 text-center">
                                    <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                                        * This is an electronically generated and certified document under the Electronic Procurement Management System. Valid even without a physical or handwritten signature.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};
