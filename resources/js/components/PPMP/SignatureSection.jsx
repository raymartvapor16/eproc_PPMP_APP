import React from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { CheckCircle, ShieldCheck, PenTool } from 'lucide-react';
import { useSignatureSettings, isSignatoryPnpkiActive, resolveSubmittedBySignatory } from '../../utils/signatureController';

export const SignatureSection = ({ ppmp, isPrintMode = false }) => {
    const { isEnabled, isPnpkiEnabled: isGlobalPnpkiEnabled } = useSignatureSettings();
    const isSignatureEnabled = ppmp?.signature_settings?.ppmp !== undefined
        ? Boolean(ppmp.signature_settings.ppmp)
        : isEnabled('ppmp');
    const isPnpkiSystemEnabled = ppmp?.signature_settings?.pnpki_enabled !== undefined
        ? Boolean(ppmp.signature_settings.pnpki_enabled)
        : isGlobalPnpkiEnabled;

    const signatures = ppmp?.signatures || [];

    const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';

    const hasTwgApproved = Boolean(
        ppmp?.twg_approved_at ||
        ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ['BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasPaccoApproved = Boolean(
        ppmp?.pacco_approved_at ||
        ['PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ['OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasHeadApproved = Boolean(
        isScopeAttachmentOnly ||
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
    );

    const preparedSig = signatures.find(s => s.role === 'end_user')
        || (ppmp?.parent?.signatures?.find(s => s.role === 'end_user'))
        || null;
    const headSig = hasHeadApproved
        ? (signatures.find(s => s.role === 'head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'head') : null))
        : null;

    const isTrustFund = Boolean(
        (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
        ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
    );

    const paccoSig = isTrustFund
        ? (isScopeAttachmentOnly
            ? (signatures.find(s => s.role === 'pacco') || ppmp?.parent?.signatures?.find(s => s.role === 'pacco') || null)
            : (hasPaccoApproved ? signatures.find(s => s.role === 'pacco') : null))
        : null;

    const budgetSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'budget_officer') || ppmp?.parent?.signatures?.find(s => s.role === 'budget_officer') || null)
        : (hasBudgetApproved ? signatures.find(s => s.role === 'budget_officer') : null);

    const oppmoSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'oppmo') || ppmp?.parent?.signatures?.find(s => s.role === 'oppmo') || null)
        : (hasOppmoApproved ? signatures.find(s => s.role === 'oppmo') : null);

    const paccoHeadSig = isTrustFund
        ? (signatures.find(s => s.role === 'pacco_head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'pacco_head') : null))
        : null;
    const budgetHeadSig = signatures.find(s => s.role === 'budget_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'budget_head') : null)
        || null;
    const oppmoHeadSig = signatures.find(s => s.role === 'oppmo_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'oppmo_head') : null)
        || null;

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    const isPreparedPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(preparedSig, ppmp?.creator);
    const submittedByResolved = resolveSubmittedBySignatory(ppmp, headSig, [oppmoHeadSig, budgetHeadSig, paccoHeadSig], hasHeadApproved);
    const submittedByUser = submittedByResolved.user;
    const submittedBySignedAt = submittedByResolved.signedAt;
    const isHeadPnpki = isPnpkiSystemEnabled && submittedByResolved.isPnpkiActive;
    const isPaccoPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(paccoSig, ppmp?.budget_reviewer || ppmp?.budgetReviewer);
    const isPaccoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(paccoHeadSig);
    const isBudgetPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetSig, ppmp?.budget_reviewer || ppmp?.budgetReviewer);
    const isBudgetHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetHeadSig);
    const isOppmoPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoSig, ppmp?.oppmo_reviewer || ppmp?.oppmoReviewer);
    const isOppmoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoHeadSig);
    const hasAnyPnpkiSig = isPreparedPnpki || isHeadPnpki || isPaccoPnpki || isPaccoHeadPnpki || isBudgetPnpki || isBudgetHeadPnpki || isOppmoPnpki || isOppmoHeadPnpki;

    const resolvedHeadName =
        headSig?.signer_name ||
        ppmp?.office_head_name ||
        ppmp?.default_signatories?.submitted_by?.name ||
        ppmp?.default_signatories?.head_of_office?.name ||
        ppmp?.office?.head?.name ||
        ppmp?.office?.head_name ||
        ppmp?.creator?.office?.head?.name ||
        ppmp?.creator?.office?.head_name ||
        '';

    const resolvedHeadDesignation =
        headSig?.signer_designation ||
        ppmp?.office_head_designation ||
        ppmp?.default_signatories?.submitted_by?.position ||
        ppmp?.default_signatories?.head_of_office?.position ||
        ppmp?.office?.head?.designation ||
        ppmp?.office?.designation ||
        ppmp?.creator?.office?.head?.designation ||
        ppmp?.creator?.office?.designation ||
        'HEAD OF OFFICE';

    return (
        <div className={`mt-6 border border-slate-900 bg-white ${isPrintMode ? 'print-signature-box' : 'shadow-sm rounded-lg overflow-hidden'}`}>

            <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">

                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Prepared By:
                    </div>

                    <div className="text-center my-2">
                        {preparedSig ? (
                            <div className="inline-flex flex-col items-center">
                                {isSignatureEnabled && preparedSig?.user?.signature_path ? (
                                    <>
                                        <div className={`h-10 flex items-center justify-center mb-1 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                            <img
                                                src={`/api/users/${preparedSig.user.id}/signature`}
                                                alt="Signature"
                                                className="max-h-10 max-w-[130px] object-contain"
                                            />
                                        </div>
                                        {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                    </>
                                ) : (!isPrintMode && isSignatureEnabled) ? (
                                    <>
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[11px] font-mono mb-1 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{preparedSig.signature_indicator}</span>
                                        </div>
                                        {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                    </>
                                ) : (
                                    <div className="h-6" />
                                )}
                                <div className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                    {preparedSig.signer_name}
                                </div>
                                <div className="text-xs text-slate-600 font-medium">
                                    {preparedSig.signer_designation || 'Project End-User / In-Charge'}
                                </div>
                                {isSignatureEnabled && (
                                    <div className={`text-[10px] text-slate-500 mt-0.5 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                        Date/Time: {formatDate(preparedSig.signed_at)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-14 flex items-center justify-center text-xs text-slate-400 italic">
                                Pending End-User Preparation
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Submitted By:
                    </div>

                    <div className="text-center my-2">
                        <div className="inline-flex flex-col items-center">
                            <div className="h-10" />
                            <div className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                {headSig?.signer_name || resolvedHeadName || 'HEAD OF OFFICE'}
                            </div>
                            <div className="text-xs text-slate-600 font-bold uppercase mt-0.5">
                                {headSig?.signer_designation || resolvedHeadDesignation || 'HEAD OF OFFICE'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-900">

                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reviewed as to Budgetary Requirement:
                    </div>

                    <div className="text-center my-2">
                        {isTrustFund ? (
                            paccoSig ? (
                                <div className="inline-flex flex-col items-center">
                                    {isSignatureEnabled && paccoHeadSig?.user?.signature_path ? (
                                        <>
                                            <div className={`h-10 flex items-center justify-center mb-1 ${!isPaccoHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${paccoHeadSig.user.id}/signature`}
                                                    alt="PACCO Head Signature"
                                                    className="max-h-10 max-w-[140px] object-contain"
                                                />
                                            </div>
                                            {!isPaccoHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                        </>
                                    ) : (
                                        <div className="h-6" />
                                    )}
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                            {ppmp?.default_signatories?.pacco_requirement?.name || (paccoSig.signer_name && paccoSig.signer_name !== 'PACCO Reviewer' ? paccoSig.signer_name : 'MAY FERNANDO-UY, CPA')}
                                        </span>
                                        {isSignatureEnabled && paccoSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${paccoSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className={`h-8 max-w-[70px] object-contain ${!isPaccoPnpki ? 'no-print print:hidden' : ''}`}
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                                        {ppmp?.default_signatories?.pacco_requirement?.position || (paccoSig.signer_designation && paccoSig.signer_designation !== 'Provincial Accounting Reviewer' ? paccoSig.signer_designation : 'Provincial Accountant')}
                                    </div>
                                    {isSignatureEnabled && (
                                        <div className={`flex items-center justify-center gap-1.5 mt-1 ${!(isPaccoHeadPnpki || isPaccoPnpki) ? 'no-print print:hidden' : ''}`}>
                                            <span className="px-2 py-0.5 bg-teal-100 border border-teal-400 text-teal-900 font-mono font-bold text-[10px] rounded">
                                                [{(paccoHeadSig || paccoSig).signature_indicator}]
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                • {formatDate((paccoHeadSig || paccoSig).signed_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-1">
                                    <div className="h-6" />
                                    <div className="font-bold text-sm uppercase text-slate-700">
                                        {ppmp?.default_signatories?.pacco_requirement?.name || 'MAY FERNANDO-UY, CPA'}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {ppmp?.default_signatories?.pacco_requirement?.position || 'Provincial Accountant'}
                                    </div>
                                    <div className="text-[11px] text-amber-600 font-medium mt-1 no-print print:hidden">
                                        Pending Certification (Trust Fund)
                                    </div>
                                </div>
                            )
                        ) : (
                            budgetSig ? (
                                <div className="inline-flex flex-col items-center">
                                    {isSignatureEnabled && budgetHeadSig?.user?.signature_path ? (
                                        <>
                                            <div className={`h-10 flex items-center justify-center mb-1 ${!isBudgetHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${budgetHeadSig.user.id}/signature`}
                                                    alt="Budget Head Signature"
                                                    className="max-h-10 max-w-[140px] object-contain"
                                                />
                                            </div>
                                            {!isBudgetHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                        </>
                                    ) : (
                                        <div className="h-6" />
                                    )}
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                            {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                        </span>
                                        {isSignatureEnabled && budgetSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${budgetSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className={`h-8 max-w-[70px] object-contain ${!isBudgetPnpki ? 'no-print print:hidden' : ''}`}
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                                        {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                    </div>
                                    {isSignatureEnabled && (
                                        <div className={`flex items-center justify-center gap-1.5 mt-1 ${!(isBudgetHeadPnpki || isBudgetPnpki) ? 'no-print print:hidden' : ''}`}>
                                            <span className="px-2 py-0.5 bg-indigo-100 border border-indigo-400 text-indigo-900 font-mono font-bold text-[10px] rounded">
                                                [{(budgetHeadSig || budgetSig).signature_indicator}]
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                • {formatDate((budgetHeadSig || budgetSig).signed_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-1">
                                    <div className="h-6" />
                                    <div className="font-bold text-sm uppercase text-slate-700">
                                        {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                    </div>
                                    <div className="text-[11px] text-amber-600 font-medium mt-1 no-print print:hidden">
                                        Pending Budget Officer Review
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reviewed by OPPMO - BAC Secretariat:
                    </div>

                    <div className="space-y-3 my-1">

                        {oppmoSig ? (
                            <div className="text-center">
                                {isSignatureEnabled && oppmoHeadSig?.user?.signature_path ? (
                                    <>
                                        <div className={`h-10 flex items-center justify-center mb-1 ${!isOppmoHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                            <img
                                                src={`/api/users/${oppmoHeadSig.user.id}/signature`}
                                                alt="OPPMO Head Signature"
                                                className="max-h-10 max-w-[140px] object-contain"
                                            />
                                        </div>
                                        {!isOppmoHeadPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                    </>
                                ) : (
                                    <div className="h-6" />
                                )}
                                <div className="flex items-center justify-center gap-2">
                                    <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                        {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                    </span>
                                    {isSignatureEnabled && oppmoSig?.user?.signature_path && (
                                        <img
                                            src={`/api/users/${oppmoSig.user.id}/signature`}
                                            alt="Initial Signature"
                                            className={`h-8 max-w-[70px] object-contain ${!isOppmoPnpki ? 'no-print print:hidden' : ''}`}
                                        />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                    {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                </div>
                                {isSignatureEnabled && (
                                    <div className={`flex items-center justify-center gap-1.5 mt-1 ${!(isOppmoHeadPnpki || isOppmoPnpki) ? 'no-print print:hidden' : ''}`}>
                                        <span className="px-2 py-0.5 bg-purple-100 border border-purple-400 text-purple-900 font-mono font-bold text-[10px] rounded">
                                            [{(oppmoHeadSig || oppmoSig).signature_indicator}]
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            • {formatDate((oppmoHeadSig || oppmoSig).signed_at)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-1">
                                <div className="h-6" />
                                <div className="font-bold text-sm uppercase text-slate-700">
                                    {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                </div>
                                <div className="text-[11px] text-amber-600 font-medium mt-0.5 no-print print:hidden">
                                    Pending BAC Secretariat Review
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isSignatureEnabled && (
                <div className={`border-t border-slate-200 bg-slate-50/50 py-1.5 px-3 text-center ${!hasAnyPnpkiSig ? 'no-print print:hidden' : ''}`}>
                    <p className="text-[9px] italic text-slate-500">
                        * This is an electronically generated document under the Electronic Procurement Management System. Signatures affixed with a valid PNPKI Digital E-Signature are electronically certified; others require a physical/handwritten signature.
                    </p>
                </div>
            )}
        </div>
    );
};
