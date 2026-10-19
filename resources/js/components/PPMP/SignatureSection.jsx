import React from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { CheckCircle, ShieldCheck, PenTool } from 'lucide-react';
import { useSignatureSettings } from '../../utils/signatureController';

export const SignatureSection = ({ ppmp, isPrintMode = false }) => {
    const { isEnabled } = useSignatureSettings();
    const isSignatureEnabled = ppmp?.signature_settings?.ppmp !== undefined
        ? Boolean(ppmp.signature_settings.ppmp)
        : isEnabled('ppmp');

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

    const isTrustFund = Boolean(
        (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
        ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
    );

    const hasPaccoApproved = Boolean(
        ppmp?.pacco_approved_at ||
        ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );

    // Signatures mapping
    const preparedSig = signatures.find(s => s.role === 'end_user')
        || (ppmp?.parent?.signatures?.find(s => s.role === 'end_user'))
        || null;
    const headSig = hasHeadApproved
        ? (signatures.find(s => s.role === 'head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'head') : null))
        : null;

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

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    return (
        <div className={`mt-6 border border-slate-900 bg-white ${isPrintMode ? 'print-signature-box' : 'shadow-sm rounded-lg overflow-hidden'}`}>
            {/* Top row: Prepared By & Submitted By */}
            <div className="grid grid-cols-2 divide-x divide-slate-900 border-b border-slate-900">
                {/* Prepared By (End User) */}
                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Prepared By:
                    </div>

                    <div className="text-center my-2">
                        {preparedSig ? (
                            <div className="inline-flex flex-col items-center">
                                {isSignatureEnabled && preparedSig?.user?.signature_path ? (
                                    <div className="h-10 flex items-center justify-center mb-1">
                                        <img
                                            src={`/api/users/${preparedSig.user.id}/signature`}
                                            alt="Signature"
                                            className="max-h-10 max-w-[130px] object-contain"
                                        />
                                    </div>
                                ) : (!isPrintMode && isSignatureEnabled) ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[11px] font-mono mb-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{preparedSig.signature_indicator}</span>
                                    </div>
                                ) : null}
                                <div className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                    {preparedSig.signer_name}
                                </div>
                                <div className="text-xs text-slate-600 font-medium">
                                    {preparedSig.signer_designation || 'Project End-User / In-Charge'}
                                </div>
                                {isSignatureEnabled && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
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

                {/* Submitted By (Head of Office) */}
                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Submitted By:
                    </div>

                    <div className="text-center my-2">
                        {headSig ? (
                            <div className="inline-flex flex-col items-center">
                                {isSignatureEnabled && headSig?.user?.signature_path ? (
                                    <div className="h-10 flex items-center justify-center mb-1">
                                        <img
                                            src={`/api/users/${headSig.user.id}/signature`}
                                            alt="Signature"
                                            className="max-h-10 max-w-[130px] object-contain"
                                        />
                                    </div>
                                ) : (!isPrintMode && isSignatureEnabled) ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-300 rounded text-blue-800 text-[11px] font-mono mb-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                        <span>{headSig.signature_indicator}</span>
                                    </div>
                                ) : null}
                                <div className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                    {headSig.signer_name}
                                </div>
                                <div className="text-xs text-slate-600 font-bold uppercase">
                                    {headSig.signer_designation || ppmp?.office?.designation || ppmp?.office?.head?.designation || 'HEAD OF OFFICE'}
                                </div>
                                {isSignatureEnabled && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        Date/Time: {formatDate(headSig.signed_at)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-14 flex items-center justify-center text-xs text-slate-400 italic">
                                {ppmp?.status === 'HEAD_PENDING' ? 'Awaiting Head Endorsement & E-Signature' : 'Pending Submission'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom row: Reviewed as to Budgetary Requirement (or Trust Fund by PACCO) & Reviewed by BAC-Secretariat */}
            <div className="grid grid-cols-2 divide-x divide-slate-900">
                {/* Reviewed as to Budgetary Requirement (General Fund) OR Trust Fund (PACCO) */}
                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reviewed as to Budgetary Requirement:
                    </div>

                    <div className="text-center my-2">
                        {isTrustFund ? (
                            paccoSig ? (
                                <div className="inline-flex flex-col items-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                            {ppmp?.default_signatories?.pacco_requirement?.name || (paccoSig.signer_name && paccoSig.signer_name !== 'PACCO Reviewer' ? paccoSig.signer_name : 'MAY FERNANDO-UY, CPA')}
                                        </span>
                                        {isSignatureEnabled && paccoSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${paccoSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className="h-8 max-w-[70px] object-contain"
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                                        {ppmp?.default_signatories?.pacco_requirement?.position || (paccoSig.signer_designation && paccoSig.signer_designation !== 'Provincial Accounting Reviewer' ? paccoSig.signer_designation : 'Provincial Accountant')}
                                    </div>
                                    {isSignatureEnabled && (
                                        <div className="flex items-center justify-center gap-1.5 mt-1">
                                            <span className="px-2 py-0.5 bg-teal-100 border border-teal-400 text-teal-900 font-mono font-bold text-[10px] rounded">
                                                [{paccoSig.signature_indicator}]
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                • {formatDate(paccoSig.signed_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-1">
                                    <div className="font-bold text-sm uppercase text-slate-700">
                                        {ppmp?.default_signatories?.pacco_requirement?.name || 'MAY FERNANDO-UY, CPA'}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {ppmp?.default_signatories?.pacco_requirement?.position || 'Provincial Accountant'}
                                    </div>
                                    <div className="text-[11px] text-amber-600 font-medium mt-1">
                                        Pending Certification (Trust Fund)
                                    </div>
                                </div>
                            )
                        ) : (
                            budgetSig ? (
                                <div className="inline-flex flex-col items-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                            {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                        </span>
                                        {isSignatureEnabled && budgetSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${budgetSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className="h-8 max-w-[70px] object-contain"
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                                        {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                    </div>
                                    {isSignatureEnabled && (
                                        <div className="flex items-center justify-center gap-1.5 mt-1">
                                            <span className="px-2 py-0.5 bg-indigo-100 border border-indigo-400 text-indigo-900 font-mono font-bold text-[10px] rounded">
                                                [{budgetSig.signature_indicator}]
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                • {formatDate(budgetSig.signed_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-1">
                                    <div className="font-bold text-sm uppercase text-slate-700">
                                        {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                    </div>
                                    <div className="text-[11px] text-amber-600 font-medium mt-1">
                                        Pending Budget Officer Review
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Reviewed by BAC-Secretariat (OPPMO Initial) */}
                <div className="p-4 flex flex-col justify-between min-h-[140px]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Reviewed by OPPMO - BAC Secretariat:
                    </div>

                    <div className="space-y-3 my-1">
                        {/* OPPMO Initial Section */}
                        {oppmoSig ? (
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="font-bold text-sm uppercase text-slate-900 underline decoration-slate-400 underline-offset-4">
                                        {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                    </span>
                                    {isSignatureEnabled && oppmoSig?.user?.signature_path && (
                                        <img
                                            src={`/api/users/${oppmoSig.user.id}/signature`}
                                            alt="Initial Signature"
                                            className="h-8 max-w-[70px] object-contain"
                                        />
                                    )}
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                    {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                </div>
                                {isSignatureEnabled && (
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                        <span className="px-2 py-0.5 bg-purple-100 border border-purple-400 text-purple-900 font-mono font-bold text-[10px] rounded">
                                            [{oppmoSig.signature_indicator}]
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            • {formatDate(oppmoSig.signed_at)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-1">
                                <div className="font-bold text-sm uppercase text-slate-700">
                                    {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                </div>
                                <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                                    Pending BAC Secretariat Review
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Electronic certification statement */}
            {isSignatureEnabled && (
                <div className="border-t border-slate-200 bg-slate-50/50 py-1.5 px-3 text-center">
                    <p className="text-[9px] italic text-slate-500">
                        * This is an electronically generated and certified document under the Electronic Procurement Management System. Valid even without a physical or handwritten signature.
                    </p>
                </div>
            )}
        </div>
    );
};
