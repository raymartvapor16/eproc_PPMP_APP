import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { Printer, ArrowLeft, Plus, Trash2, Edit3, Loader2, Sparkles, ShieldCheck, History, X, Eye, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { ppmpService } from '../../services/api';
import { PimsPublishModal } from '../Monitoring/PimsPublishModal';
import { GeneratePurchaseRequestModal } from '../PIMS/GeneratePurchaseRequestModal';
import { PurchaseRequestPrintView } from '../PIMS/PurchaseRequestPrintView';
import { formatDescription6Words, formatMonthYear, toMonthInputValue, MonthRangeInput } from './ProcurementPlanTable';
import { useSignatureSettings, isSignatoryPnpkiActive } from '../../utils/signatureController';
import { usePimsStatus } from '../../hooks/usePimsStatus';
import { canUserAccessSystem } from '../UI/UnauthorizedSystemAccessView';
import { PrintExportDropdown } from '../UI/PrintExportDropdown';
import { ResponsivePrintDocument } from '../UI/ResponsivePrintDocument';
import { exportElementsToPdf } from '../../utils/pdfExport';

export const APPPrintView = ({ ppmp, user, canEdit = true, onBack, onGenerated }) => {
    const appPrintRef = useRef(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const { isEnabled, isPnpkiEnabled: isGlobalPnpkiEnabled } = useSignatureSettings();
    const isAppSignatureEnabled = ppmp?.signature_settings?.app !== undefined
        ? Boolean(ppmp.signature_settings.app)
        : isEnabled('app');
    const isPnpkiSystemEnabled = ppmp?.signature_settings?.pnpki_enabled !== undefined
        ? Boolean(ppmp.signature_settings.pnpki_enabled)
        : isGlobalPnpkiEnabled;

    const savedData = ppmp?.app_data || null;
    const needsRegeneration = Boolean(savedData?.needs_regeneration);
    const hasValidSavedData = Boolean(savedData?.rows && Array.isArray(savedData.rows) && savedData.rows.length > 0 && !needsRegeneration);

    const isTwgSkipped = Boolean(ppmp?.amendment_type === 'AMENDMENT' && ppmp?.amendment_scope === 'PPMP_APP');
    const isTwgDone = Boolean(isTwgSkipped || ppmp?.twg_approved_at || ppmp?.signatures?.some(s => s.role === 'twg'));
    const isOppmoAuthorized = (user?.role === 'oppmo' && isTwgDone && (ppmp?.status === 'OPPMO_REVIEW' || ppmp?.status === 'READY_TO_PRINT'));
    const allowEdit = canEdit && (isOppmoAuthorized || ['admin', 'super_admin'].includes(user?.role));

    const [isEditing, setIsEditing] = useState((!hasValidSavedData || needsRegeneration) && allowEdit);
    const [saving, setSaving] = useState(false);
    const [showOldAppModal, setShowOldAppModal] = useState(false);

    const { isPimsActive } = usePimsStatus();
    const [isPimsPublishModalOpen, setIsPimsPublishModalOpen] = useState(false);
    const [isGeneratePrModalOpen, setIsGeneratePrModalOpen] = useState(false);
    const [selectedMonitoringProjectId, setSelectedMonitoringProjectId] = useState(null);
    const [selectedPrForPrint, setSelectedPrForPrint] = useState(null);

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

    const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';

    const hasTwgApproved = Boolean(
        ppmp?.twg_approved_at ||
        ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ['BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ['BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasHeadApproved = Boolean(
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
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

    const budgetHeadSig = signatures.find(s => s.role === 'budget_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'budget_head') : null)
        || null;
    const paccoHeadSig = signatures.find(s => s.role === 'pacco_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'pacco_head') : null)
        || null;
    const oppmoHeadSig = signatures.find(s => s.role === 'oppmo_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'oppmo_head') : null)
        || null;
    const appPreparerSig = signatures.find(s => s.role === 'app_preparer')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'app_preparer') : null)
        || null;
    const governorSig = signatures.find(s => s.role === 'governor')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'governor') : null)
        || null;

    const isBudgetPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetSig, ppmp?.budget_reviewer || ppmp?.budgetReviewer);
    const isBudgetHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetHeadSig);
    const isPaccoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(paccoHeadSig);
    const isOppmoPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoSig, ppmp?.oppmo_reviewer || ppmp?.oppmoReviewer);
    const isOppmoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoHeadSig);
    const isAppPreparerPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(appPreparerSig);
    const isGovernorPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(governorSig);
    const displayRecommendingHeadSig = budgetHeadSig || paccoHeadSig || null;
    const isRecommendingHeadPnpki = Boolean(
        (budgetHeadSig && isBudgetHeadPnpki) ||
        (!budgetHeadSig && paccoHeadSig && isPaccoHeadPnpki)
    );
    const hasAnyAppPnpkiSig = isBudgetPnpki || isBudgetHeadPnpki || isPaccoHeadPnpki || isOppmoPnpki || isOppmoHeadPnpki || isAppPreparerPnpki || isGovernorPnpki;

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    const dbAppPrepared = ppmp?.default_signatories?.app_prepared_by;
    const dbAppReviewed = ppmp?.default_signatories?.app_reviewed_by || ppmp?.default_signatories?.bac_secretariat;
    const dbAppRecommending = ppmp?.default_signatories?.app_recommending || ppmp?.default_signatories?.budget_requirement;
    const dbAppApproved = ppmp?.default_signatories?.app_approved_by || ppmp?.default_signatories?.approved_by;

    const isLegacyNorjannaPreparer = Boolean(
        (
            savedData?.prepared_by_name === 'NORJANNA M. CAMAGUIN, MPA' ||
            (dbAppReviewed?.name && savedData?.prepared_by_name === dbAppReviewed.name)
        ) && (!savedData?.reviewed_by_name || savedData?.reviewed_by_name === savedData?.prepared_by_name)
    );

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

    const resolveEndUser = (ppmpData, fallback = 'Implementing Unit') => {
        const implementingOffice = (ppmpData?.implementing_unit || ppmpData?.office?.name || '').trim();
        const program = (ppmpData?.program_name ? String(ppmpData.program_name) : '').trim();

        if (implementingOffice && program) {
            return `${implementingOffice} - ${program}`;
        }
        if (implementingOffice) {
            return implementingOffice;
        }
        if (program) {
            return program;
        }
        return fallback;
    };

    const trackerNo = ppmp?.tracking_number || ppmp?.ppmp_number || '';

    const buildRemarksWithTracker = (itemRemarks) => {
        const trackerStr = trackerNo ? String(trackerNo).trim() : '';
        let existingStr = itemRemarks ? String(itemRemarks).trim() : '';

        if (existingStr) {
            existingStr = existingStr.replace(/^Tracker No\.?:?\s*/i, '').trim();
        }

        if (trackerStr && existingStr) {
            if (existingStr.toLowerCase() === trackerStr.toLowerCase()) {
                return trackerStr;
            }
            if (existingStr.toLowerCase().includes(trackerStr.toLowerCase())) {
                return existingStr;
            }
            return `${trackerStr}\n${existingStr}`;
        }

        return trackerStr || existingStr;
    };

    const buildProjectTitle = (item) => {
        const desc = (item?.description || '').trim();
        const fallbackRetention = item?.is_retention
            ? `${item.retention_percentage ? `${item.retention_percentage}% ` : ''}Retention`
            : '';
        const label = desc || fallbackRetention;
        if (ppmp?.account_code && label) return `${ppmp.account_code}\n${label}`;
        return label || ppmp?.account_code || '';
    };

    const [rows, setRows] = useState(() => {
        const items = ppmp?.items || [];
        const nonHeaderItems = items.filter(i => !i.is_header);

        const defaultEndUser = resolveEndUser(ppmp);

        if (hasValidSavedData) {
            const unit = (ppmp?.implementing_unit || ppmp?.office?.name || '').trim();
            const prog = (ppmp?.program_name ? String(ppmp.program_name) : '').trim();

            return savedData.rows.map((row, idx) => {
                const matchingItem = nonHeaderItems[idx] || nonHeaderItems.find(i => (i.id && i.id === row.id) || (i.description && i.description === row.projectTitle));
                const expectedType = resolveProjectType(matchingItem, ppmp);

                const currentValLower = String(row.generalDescription || '').trim().toLowerCase();
                const isKnownType = ['goods', 'infrastructure', 'infrastructure projects', 'consulting', 'consulting services']
                    .includes(currentValLower);

                let updatedRow = { ...row };

                if (!isKnownType) {
                    updatedRow.generalDescription = expectedType;
                }

                const currentEndUser = String(row.endUser || '').trim();
                if (
                    !currentEndUser ||
                    currentEndUser.toLowerCase() === 'implementing unit' ||
                    (prog && currentEndUser.toLowerCase() === prog.toLowerCase()) ||
                    (unit && prog && currentEndUser.toLowerCase() === unit.toLowerCase())
                ) {
                    updatedRow.endUser = defaultEndUser;
                }

                const rawRemarks = updatedRow.procurementStrategy !== undefined && updatedRow.procurementStrategy !== null
                    ? String(updatedRow.procurementStrategy).trim()
                    : '';
                const cleanedRemarks = rawRemarks.replace(/^Tracker No\.?:?\s*/i, '').trim();

                if (!cleanedRemarks) {
                    updatedRow.procurementStrategy = buildRemarksWithTracker(matchingItem?.remarks);
                } else if (trackerNo && !cleanedRemarks.toLowerCase().includes(trackerNo.toLowerCase())) {
                    updatedRow.procurementStrategy = buildRemarksWithTracker(cleanedRemarks);
                } else {
                    updatedRow.procurementStrategy = cleanedRemarks;
                }

                return updatedRow;
            });
        }

        if (nonHeaderItems.length > 0) {
            return nonHeaderItems.map((item, idx) => ({
                id: item.id || idx + 1,
                projectTitle: buildProjectTitle(item),
                endUser: defaultEndUser,
                generalDescription: resolveProjectType(item, ppmp),
                modeOfProcurement: item.procurement_mode || 'Public Bidding',
                earlyProcurement: item.pre_proc_conference ? 'YES' : 'NO',
                criteria: 'LCRB',
                startDate: item.start_date ? formatMonthYear(item.start_date) : '',
                endDate: item.end_date ? formatMonthYear(item.end_date) : '',
                sourceOfFund: item.source_of_fund || 'General Fund',
                estimatedBudget: item.estimated_budget || 0,
                procurementStrategy: buildRemarksWithTracker(item.remarks),
                isRetention: Boolean(item.is_retention),
                retentionPercentage: item.retention_percentage ?? null,
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
                procurementStrategy: buildRemarksWithTracker(''),
            }
        ];
    });

    const reloadRowsFromPpmp = () => {
        const items = ppmp?.items || [];
        const nonHeaderItems = items.filter(i => !i.is_header);
        const defaultEndUser = resolveEndUser(ppmp);

        if (nonHeaderItems.length > 0) {
            const freshRows = nonHeaderItems.map((item, idx) => ({
                id: item.id || idx + 1,
                projectTitle: buildProjectTitle(item),
                endUser: defaultEndUser,
                generalDescription: resolveProjectType(item, ppmp),
                modeOfProcurement: item.procurement_mode || 'Public Bidding',
                earlyProcurement: item.pre_proc_conference ? 'YES' : 'NO',
                criteria: 'LCRB',
                startDate: item.start_date ? formatMonthYear(item.start_date) : '',
                endDate: item.end_date ? formatMonthYear(item.end_date) : '',
                sourceOfFund: item.source_of_fund || 'General Fund',
                estimatedBudget: item.estimated_budget || 0,
                procurementStrategy: buildRemarksWithTracker(item.remarks),
                isRetention: Boolean(item.is_retention),
                retentionPercentage: item.retention_percentage ?? null,
            }));
            setRows(freshRows);
        }
    };

    useEffect(() => {
        if (needsRegeneration) {
            reloadRowsFromPpmp();
        }
    }, [ppmp?.updated_at, needsRegeneration]);

    const handleUpdateRow = (index, field, value) => {
        const updated = [...rows];
        updated[index] = { ...updated[index], [field]: value };
        setRows(updated);
    };

    const handleAddRow = () => {
        const defaultEndUser = resolveEndUser(ppmp, '');

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
                procurementStrategy: buildRemarksWithTracker(''),
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
            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 0 !important;
                    }
                    body {
                        padding: 8mm !important;
                    }
                }
            `}</style>

            <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-md">
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700 transition cursor-pointer shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Workspace
                    </button>
                    <div className="min-w-0">
                        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 flex-wrap">
                            <span>Annual Procurement Plan (APP) — Province of Davao del Sur</span>
                            {!canEdit && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-900 text-indigo-200 border border-indigo-700 shrink-0">
                                    Baseline / Old APP
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-blue-400 font-mono">
                            {isEditing ? 'Configuring / Edit Mode' : 'Official Clean Printable View (CY ' + fiscalYear + ')'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 flex-wrap shrink-0">

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
                            <>
                                <PrintExportDropdown
                                    label="Print / Download PDF"
                                    printLabel="Print APP"
                                    printSublabel="Open browser print dialog"
                                    downloadLabel="Download APP (PDF)"
                                    downloadSublabel="Save official APP as .pdf file"
                                    onPrint={handlePrint}
                                    onDownloadPdf={async () => {
                                        if (!appPrintRef.current || isExportingPdf) return;
                                        setIsExportingPdf(true);
                                        try {
                                            const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'APP';
                                            await exportElementsToPdf({
                                                element: appPrintRef.current,
                                                filename: `APP_${tracker}.pdf`,
                                                orientation: 'landscape',
                                                format: 'legal',
                                                marginMm: 6,
                                            });
                                        } catch (err) {
                                            console.error('Failed to export APP PDF:', err);
                                            alert('Failed to generate APP PDF file. Please try printing and choosing Save as PDF.');
                                        } finally {
                                            setIsExportingPdf(false);
                                        }
                                    }}
                                    isExporting={isExportingPdf}
                                />
                                {canUserAccessSystem(user, '/pims') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isPimsActive) {
                                                setIsGeneratePrModalOpen(true);
                                            } else {
                                                setIsPimsPublishModalOpen(true);
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition cursor-pointer"
                                        title={isPimsActive ? "Publish procurement requirement to PIMS and generate official Purchase Request" : "Publish procurement requirement to PIMS & initiate monitoring workflow"}
                                    >
                                        <Sparkles className="w-4 h-4 text-amber-300" />
                                        <span>{isPimsActive ? "PUBLISH TO PIMS / PR" : "PUBLISH TO PIMS"}</span>
                                    </button>
                                )}
                            </>
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

            <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
                {needsRegeneration && allowEdit && (
                    <div className="mb-5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 no-print shadow-xs">
                        <div className="flex items-center gap-2.5">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                                <span className="font-bold text-amber-950 block">Annual Procurement Plan (APP) Regeneration Required</span>
                                <span className="text-[11px] text-amber-800">
                                    Changes were made on this amended/supplemental PPMP. Fresh items and budgets have been loaded from the PPMP. As OPPMO Reviewer, please review the lines and click <strong>Save & View Printable APP</strong> to generate the updated official APP. The previous APP is safely preserved.
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={reloadRowsFromPpmp}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                title="Reload latest line items directly from the PPMP"
                            >
                                <RefreshCw className="w-3.5 h-3.5 text-amber-800" />
                                <span>Re-fetch PPMP Items</span>
                            </button>
                            {savedData?.old_app && (
                                <button
                                    type="button"
                                    onClick={() => setShowOldAppModal(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                >
                                    <History className="w-3.5 h-3.5 text-amber-700" />
                                    <span>View Previous APP</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {needsRegeneration && !allowEdit && (
                    <div className="mb-5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2.5 no-print shadow-xs">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="font-bold text-amber-950 block">Changes Detected in PPMP (Read-Only Preview)</span>
                            <span className="text-[11px] text-amber-800">
                                Modifications were made on this PPMP. The official Annual Procurement Plan (APP) is pending regeneration by the OPPMO Reviewer.
                            </span>
                        </div>
                    </div>
                )}
                {isEditing ? (

                    <div className="space-y-6">

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

                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                                Signatories Configuration
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">

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
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={reloadRowsFromPpmp}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                                        title="Reload and overwrite rows with latest PPMP items and budgets"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 text-amber-800" /> Re-fetch from PPMP
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Project Row
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-slate-200 text-xs">
                                    <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="border border-slate-300 p-2 text-left min-w-[240px]">Project Title</th>
                                            <th className="border border-slate-300 p-2 text-left min-w-[240px]">End-User / Unit</th>
                                            <th className="border border-slate-300 p-2 text-left w-36">General Description of the Project</th>
                                            <th className="border border-slate-300 p-2 text-left">Mode of Procurement</th>
                                            <th className="border border-slate-300 p-2 w-16">Early Proc?</th>
                                            <th className="border border-slate-300 p-2 w-20">Evaluation Criteria</th>
                                            <th className="border border-slate-300 p-2 w-24">Start (MM/YYYY)</th>
                                            <th className="border border-slate-300 p-2 w-24">End (MM/YYYY)</th>
                                            <th className="border border-slate-300 p-2 text-left">Source of Fund</th>
                                            <th className="border border-slate-300 p-2 w-28 text-right">Estimated Budget</th>
                                            <th className="border border-slate-300 p-2 text-left">Procurement Strategy or Tools</th>
                                            <th className="border border-slate-300 p-2 text-left">Remarks</th>
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
                                                    <textarea
                                                        rows={2}
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
                                                    <textarea
                                                        rows={2}
                                                        value={row.procurementStrategyTools || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'procurementStrategyTools', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                        placeholder="Strategy or tools..."
                                                    />
                                                </td>
                                                <td className="border border-slate-200 p-1">
                                                    <textarea
                                                        rows={2}
                                                        value={row.procurementStrategy || ''}
                                                        onChange={(e) => handleUpdateRow(idx, 'procurementStrategy', e.target.value)}
                                                        className="w-full p-1 border border-slate-200 rounded text-xs"
                                                        placeholder={trackerNo || 'Remarks...'}
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
                                            <td colSpan={3}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

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
                    <ResponsivePrintDocument paperWidth={1280}>
                    <div ref={appPrintRef} className="pdf-export-root bg-white text-black font-bold p-4 sm:p-6 print:p-0 print:max-w-none">

                        <div className="flex flex-col items-center justify-center text-center relative mb-4 space-y-1">
                            <img
                                src="/images/logo.png"
                                alt="Province of Davao del Sur Seal"
                                className="w-18 h-18 object-contain mb-1"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="text-sm font-bold uppercase tracking-wide leading-snug whitespace-nowrap">
                                Republic of the Philippines
                            </div>
                            <div className="text-lg font-extrabold uppercase tracking-wide leading-snug whitespace-nowrap">
                                PROVINCE OF DAVAO DEL SUR
                            </div>
                            <div className="text-base font-extrabold uppercase tracking-wide leading-snug whitespace-nowrap">
                                ANNUAL PROCUREMENT PLAN FOR CY {fiscalYear}
                            </div>

                            <div className="flex items-center justify-center gap-8 text-xs font-extrabold pt-1.5 whitespace-nowrap">
                                <label className="inline-flex items-center gap-1.5 cursor-default whitespace-nowrap shrink-0">
                                    <span className={`w-4 h-4 shrink-0 border-2 border-black inline-flex items-center justify-center text-xs leading-none ${planVersionType === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'INDICATIVE' ? '✓' : ''}
                                    </span>
                                    <span className="whitespace-nowrap">INDICATIVE</span>
                                </label>

                                <label className="inline-flex items-center gap-1.5 cursor-default whitespace-nowrap shrink-0">
                                    <span className={`w-4 h-4 shrink-0 border-2 border-black inline-flex items-center justify-center text-xs leading-none ${planVersionType === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'FINAL' ? '✓' : ''}
                                    </span>
                                    <span className="whitespace-nowrap">FINAL</span>
                                </label>

                                <label className="inline-flex items-center gap-1.5 cursor-default whitespace-nowrap shrink-0">
                                    <span className={`w-4 h-4 shrink-0 border-2 border-black inline-flex items-center justify-center text-xs leading-none ${planVersionType === 'UPDATED' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                        {planVersionType === 'UPDATED' ? '✓' : ''}
                                    </span>
                                    <span className="whitespace-nowrap">UPDATED VERSION NO. {updatedVersionNo || ''}</span>
                                </label>
                            </div>
                        </div>

                        <table className="w-full table-fixed border-collapse border-2 border-black text-xs font-bold leading-snug print-table">
                            <colgroup>
                                <col style={{ width: '19%' }} />
                                <col style={{ width: '19%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '4.5%' }} />
                                <col style={{ width: '6.5%' }} />
                                <col style={{ width: '8.5%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '7%' }} />
                            </colgroup>
                            <thead>

                                <tr className="text-center font-extrabold border-b border-black bg-slate-50">
                                    <th colSpan={6} className="border border-black p-1.5 uppercase">
                                        PROCUREMENT PROJECT DETAILS
                                    </th>
                                    <th colSpan={2} className="border border-black p-1.5 uppercase">
                                        PROJECTED TIMELINE (MM/YYYY)
                                    </th>
                                    <th colSpan={2} className="border border-black p-1.5 uppercase">
                                        FUNDING DETAILS
                                    </th>
                                    <th rowSpan={2} className="border border-black p-1 text-[10px] align-bottom uppercase break-words">
                                        PROCUREMENT STRATEGY OR TOOLS
                                    </th>
                                    <th rowSpan={2} className="border border-black p-1 text-[10px] align-bottom break-words">
                                        REMARKS (Other relevant descriptions of the procurement project, if applicable)
                                    </th>
                                </tr>

                                <tr className="text-center font-extrabold border-b-2 border-black bg-slate-50">
                                    <th className="border border-black p-1.5 align-bottom">Project Title</th>
                                    <th className="border border-black p-1.5 align-bottom">End-User or Implementing Unit</th>
                                    <th className="border border-black p-1 text-[11px] align-bottom">General Description of the Project</th>
                                    <th className="border border-black p-1 text-[11px] align-bottom">Mode of Procurement</th>
                                    <th className="border border-black p-1 text-[10px] align-bottom">To be covered by an Early Procurement Activity? (Yes/No)</th>
                                    <th className="border border-black p-1 text-[10px] align-bottom">Criteria for Bid Evaluation (Including Sustainability and Domestic Preference)</th>
                                    <th className="border border-black p-1 text-[10px] align-bottom">Start of Procurement Activity</th>
                                    <th className="border border-black p-1 text-[10px] align-bottom">End of Procurement Activity</th>
                                    <th className="border border-black p-1 text-[11px] align-bottom">Source of Fund</th>
                                    <th className="border border-black p-1 text-[10px] align-bottom">Estimated Budget /Approved Budget for the Contract (PhP)</th>
                                </tr>
                            </thead>
                            <tbody>

                                <tr className="border-b border-black bg-white">
                                    <td colSpan={12} className="border border-black px-2 py-1 text-left font-extrabold text-xs">
                                        General Requirements
                                    </td>
                                </tr>

                                {rows.map((row, idx) => (
                                    <tr key={idx} className="min-h-7 font-bold">
                                        <td className="border border-black px-2 py-2 align-top text-center font-extrabold whitespace-pre-wrap break-words">
                                            {formatDescription6Words(row.projectTitle)}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold uppercase break-words">
                                            {row.endUser}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold whitespace-pre-wrap break-words">
                                            {formatDescription6Words(row.generalDescription)}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold break-words">
                                            {row.modeOfProcurement}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-extrabold">
                                            {row.earlyProcurement}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-extrabold">
                                            {row.criteria || 'LCRB'}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold">
                                            {row.startDate ? formatMonthYear(row.startDate) : '—'}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold">
                                            {row.endDate ? formatMonthYear(row.endDate) : '—'}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold break-words">
                                            {row.sourceOfFund}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-right tabular-nums font-extrabold break-words">
                                            {row.estimatedBudget ? formatCurrency(row.estimatedBudget) : '—'}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold whitespace-pre-wrap break-words">
                                            {row.procurementStrategyTools || ''}
                                        </td>
                                        <td className="border border-black px-1.5 py-2 align-top text-center font-bold whitespace-pre-wrap break-words">
                                            {row.procurementStrategy}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black font-extrabold text-sm bg-slate-50">
                                    <td colSpan={9} className="border border-black p-2 text-right uppercase">
                                        Total Estimated Budget:
                                    </td>
                                    <td className="border border-black px-1.5 py-2 text-right tabular-nums font-extrabold break-words">
                                        {formatCurrency(totalAppBudget)}
                                    </td>
                                    <td colSpan={2} className="border border-black"></td>
                                </tr>
                            </tfoot>
                        </table>
                        <br />

                        <div className="mt-6 text-black text-xs font-bold px-2 print-signature-box pdf-avoid-break">
                            <div className="grid grid-cols-4 gap-4 items-start">

                                <div>
                                    <div className="font-extrabold mb-2 text-left">Prepared by:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        {isAppSignatureEnabled && appPreparerSig?.user?.signature_path ? (
                                            <>
                                                <div className={`h-7 flex items-center justify-center ${!isAppPreparerPnpki ? 'no-print print:hidden' : ''}`}>
                                                    <img
                                                        src={`/api/users/${encodeURIComponent(appPreparerSig.user.encrypted_id)}/signature`}
                                                        alt="APP Preparer Signature"
                                                        className="max-h-7 max-w-[110px] object-contain"
                                                    />
                                                </div>
                                                {!isAppPreparerPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                            </>
                                        ) : (
                                            <div className="h-6" />
                                        )}
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                                {preparedByName}
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold uppercase whitespace-nowrap mt-0.5">
                                            {preparedByPosition}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="font-extrabold mb-2 text-left">Reviewed by:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        {isAppSignatureEnabled && oppmoHeadSig?.user?.signature_path ? (
                                            <>
                                                <div className={`h-7 flex items-center justify-center ${!isOppmoHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                    <img
                                                        src={`/api/users/${encodeURIComponent(oppmoHeadSig.user.encrypted_id)}/signature`}
                                                        alt="OPPMO Head Signature"
                                                        className="max-h-7 max-w-[110px] object-contain"
                                                    />
                                                </div>
                                                {!isOppmoHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                            </>
                                        ) : (
                                            <div className="h-6" />
                                        )}
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                                {reviewedByName}
                                            </div>
                                            {isAppSignatureEnabled && oppmoSig?.user?.signature_path && (
                                                <img
                                                    src={`/api/users/${encodeURIComponent(oppmoSig.user.encrypted_id)}/signature`}
                                                    alt="Signature"
                                                    className={`h-6 max-w-[60px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none ${!isOppmoPnpki ? 'no-print print:hidden' : ''}`}
                                                />
                                            )}
                                        </div>
                                        <div className="text-xs font-bold uppercase whitespace-nowrap mt-0.5">
                                            {reviewedByPosition}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="font-extrabold mb-2 text-left">Recommending Approval:</div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        {isAppSignatureEnabled && displayRecommendingHeadSig?.user?.signature_path ? (
                                            <>
                                                <div className={`h-7 flex items-center justify-center ${!isRecommendingHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                    <img
                                                        src={`/api/users/${encodeURIComponent(displayRecommendingHeadSig.user.encrypted_id)}/signature`}
                                                        alt="Recommending Head Signature"
                                                        className="max-h-7 max-w-[110px] object-contain"
                                                    />
                                                </div>
                                                {!isRecommendingHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                            </>
                                        ) : (
                                            <div className="h-6" />
                                        )}
                                        <div className="relative inline-flex items-center justify-center">
                                            <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                                {recommendingName}
                                            </div>
                                            {isAppSignatureEnabled && budgetSig?.user?.signature_path && (
                                                <img
                                                    src={`/api/users/${encodeURIComponent(budgetSig.user.encrypted_id)}/signature`}
                                                    alt="Signature"
                                                    className={`h-6 max-w-[60px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none ${!isBudgetPnpki ? 'no-print print:hidden' : ''}`}
                                                />
                                            )}
                                        </div>
                                        <div className="text-xs uppercase mt-0.5 font-bold whitespace-nowrap">
                                            {recommendingPosition}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="font-extrabold mb-2 text-left">
                                        Approved by:
                                    </div>
                                    <div className="text-center flex flex-col items-center justify-end">
                                        {isAppSignatureEnabled && governorSig?.user?.signature_path ? (
                                            <>
                                                <div className={`h-7 flex items-center justify-center ${!isGovernorPnpki ? 'no-print print:hidden' : ''}`}>
                                                    <img
                                                        src={`/api/users/${encodeURIComponent(governorSig.user.encrypted_id)}/signature`}
                                                        alt="Governor Signature"
                                                        className="max-h-7 max-w-[110px] object-contain"
                                                    />
                                                </div>
                                                {!isGovernorPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                            </>
                                        ) : (
                                            <div className="h-6" />
                                        )}
                                        <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                            {approvedByName}
                                        </div>
                                        <div className="text-xs uppercase mt-0.5 font-bold whitespace-nowrap">
                                            {approvedByPosition}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {isAppSignatureEnabled && (
                                <div className={`mt-4 pt-2 border-t border-dotted border-slate-300 text-center ${!hasAnyAppPnpkiSig ? 'no-print print:hidden' : ''}`}>
                                    <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                                        * This is an electronically generated document under the Electronic Procurement Management System. Signatures affixed with a valid PNPKI Digital E-Signature are electronically certified; others require a physical/handwritten signature.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    </ResponsivePrintDocument>
                )}
            </div>

            {showOldAppModal && savedData?.old_app && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <History className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                                        Previous APP Baseline (Preserved)
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Archived Annual Procurement Plan before revision modifications
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowOldAppModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto overflow-x-auto flex-1 bg-slate-50">
                            <table className="w-full text-left text-xs border border-slate-300 bg-white shadow-xs rounded">
                                <thead className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold text-[11px]">
                                    <tr className="divide-x divide-slate-300">
                                        <th className="p-2 w-10 text-center">#</th>
                                        <th className="p-2 min-w-[200px]">Project Title</th>
                                        <th className="p-2">End-User</th>
                                        <th className="p-2">General Description</th>
                                        <th className="p-2">Mode of Procurement</th>
                                        <th className="p-2">Source of Funds</th>
                                        <th className="p-2 text-right">Estimated Budget</th>
                                        <th className="p-2 min-w-[150px]">Remarks / Tracker</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {Array.isArray(savedData.old_app.rows) && savedData.old_app.rows.length > 0 ? (
                                        savedData.old_app.rows.map((r, i) => (
                                            <tr key={i} className="divide-x divide-slate-200 hover:bg-slate-50">
                                                <td className="p-2 text-center font-mono">{i + 1}</td>
                                                <td className="p-2 font-semibold whitespace-pre-wrap">{r.projectTitle}</td>
                                                <td className="p-2">{r.endUser}</td>
                                                <td className="p-2">{r.generalDescription}</td>
                                                <td className="p-2">{r.modeOfProcurement}</td>
                                                <td className="p-2">{r.sourceOfFund || r.source_of_fund || 'General Fund'}</td>
                                                <td className="p-2 text-right font-mono font-bold text-blue-900">
                                                    {formatCurrency(r.estimatedBudget)}
                                                </td>
                                                <td className="p-2 text-slate-600 whitespace-pre-wrap">{r.procurementStrategy || '—'}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-4 text-center text-slate-500 italic">
                                                No previous APP line items recorded in baseline.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowOldAppModal(false)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isPimsActive && (
                <PimsPublishModal
                    isOpen={isPimsPublishModalOpen}
                    onClose={() => setIsPimsPublishModalOpen(false)}
                    ppmp={ppmp}
                    onSuccess={(project) => {
                        setSelectedMonitoringProjectId(project?.id);
                    }}
                />
            )}

            {isPimsActive && (
                <GeneratePurchaseRequestModal
                    isOpen={isGeneratePrModalOpen}
                    onClose={() => setIsGeneratePrModalOpen(false)}
                    ppmpUuid={ppmp?.uuid}
                    monitoringProjectId={selectedMonitoringProjectId}
                    onSuccess={(newPr) => {
                        setSelectedPrForPrint(newPr);
                    }}
                />
            )}

            {selectedPrForPrint && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
                    <PurchaseRequestPrintView
                        purchaseRequest={selectedPrForPrint}
                        onBack={() => setSelectedPrForPrint(null)}
                    />
                </div>
            )}
        </div>
    );
};
