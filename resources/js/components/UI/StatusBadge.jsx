import React from 'react';

export const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return '₱' + num.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

export const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const getStatusConfig = (status) => {
    switch (status) {
        case 'DRAFT':
            return {
                label: 'Draft',
                bg: 'bg-slate-100 text-slate-700 border-slate-300',
                dot: 'bg-slate-400',
                desc: 'Created by End User, currently being drafted.',
            };
        case 'HEAD_PENDING':
            return {
                label: 'Pending Head Approval',
                bg: 'bg-amber-100 text-amber-800 border-amber-300',
                dot: 'bg-amber-500 animate-pulse',
                desc: 'Awaiting review and endorsement from the Office Head.',
            };
        case 'HEAD_RETURNED':
            return {
                label: 'Returned by Head',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by Office Head with required corrections.',
            };
        case 'HEAD_APPROVED':
            return {
                label: 'Head Endorsed',
                bg: 'bg-blue-100 text-blue-800 border-blue-300',
                dot: 'bg-blue-500',
                desc: 'Endorsed by Office Head. Ready to be submitted for formal review.',
            };
        case 'BUDGET_OFFICER_REVIEW':
            return {
                label: 'Budget Officer Review',
                bg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                dot: 'bg-indigo-500 animate-pulse',
                desc: 'Awaiting budgetary review and fund allocation certification.',
            };
        case 'BUDGET_OFFICER_RETURNED':
            return {
                label: 'Returned by Budget Officer',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by Budget Officer. Remarks need compliance.',
            };
        case 'BUDGET_HEAD_REVIEW':
            return {
                label: 'Budget Head Review',
                bg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                dot: 'bg-indigo-500 animate-pulse',
                desc: 'Certified by Budget Reviewer. Awaiting Budget Office Head review & PNPKI e-signature.',
            };
        case 'BUDGET_HEAD_RETURNED':
            return {
                label: 'Returned by Budget Head',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by Budget Office Head. Remarks need compliance.',
            };
        case 'PACCO_REVIEW':
            return {
                label: 'PACCO Review',
                bg: 'bg-teal-100 text-teal-800 border-teal-300',
                dot: 'bg-teal-500 animate-pulse',
                desc: 'Awaiting Trust Fund verification and certification from PACCO.',
            };
        case 'PACCO_RETURNED':
            return {
                label: 'Returned by PACCO',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by PACCO Reviewer. Remarks need compliance.',
            };
        case 'PACCO_HEAD_REVIEW':
            return {
                label: 'PACCO Head Review',
                bg: 'bg-teal-100 text-teal-800 border-teal-300',
                dot: 'bg-teal-500 animate-pulse',
                desc: 'Certified by PACCO Reviewer. Awaiting PACCO Head review & PNPKI e-signature.',
            };
        case 'PACCO_HEAD_RETURNED':
            return {
                label: 'Returned by PACCO Head',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by PACCO Head. Remarks need compliance.',
            };
        case 'PACCO_APPROVED':
            return {
                label: 'PACCO Approved',
                bg: 'bg-teal-100 text-teal-800 border-teal-300',
                dot: 'bg-teal-500',
                desc: 'Trust Fund requirements certified by PACCO.',
            };
        case 'OPPMO_REVIEW':
            return {
                label: 'OPPMO Review',
                bg: 'bg-purple-100 text-purple-800 border-purple-300',
                dot: 'bg-purple-500 animate-pulse',
                desc: 'In review with Office of the Provincial Procurement Management Officer.',
            };
        case 'OPPMO_HEAD_REVIEW':
            return {
                label: 'OPPMO Head Review',
                bg: 'bg-purple-100 text-purple-800 border-purple-300',
                dot: 'bg-purple-500 animate-pulse',
                desc: 'APP verified by OPPMO Reviewer. Awaiting OPPMO Head review & PNPKI e-signature.',
            };
        case 'OPPMO_HEAD_RETURNED':
            return {
                label: 'Returned by OPPMO Head',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by OPPMO Head. Remarks need compliance.',
            };
        case 'APP_PREPARER_REVIEW':
            return {
                label: 'APP Preparer Review',
                bg: 'bg-sky-100 text-sky-800 border-sky-300',
                dot: 'bg-sky-500 animate-pulse',
                desc: 'Awaiting APP Preparer review & PNPKI e-signature.',
            };
        case 'APP_PREPARER_RETURNED':
            return {
                label: 'Returned by APP Preparer',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by APP Preparer. Remarks need compliance.',
            };
        case 'GOVERNOR_REVIEW':
            return {
                label: 'Governor Approval Review',
                bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                dot: 'bg-emerald-500 animate-pulse',
                desc: 'Awaiting Provincial Governor final review & PNPKI e-signature.',
            };
        case 'GOVERNOR_RETURNED':
            return {
                label: 'Returned by Governor',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by Provincial Governor. Remarks need compliance.',
            };
        case 'OPPMO_RETURNED':
            return {
                label: 'Returned by OPPMO',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by OPPMO for procurement method or schedule clarification.',
            };
        case 'TWG_REVIEW':
            return {
                label: 'BAC-TWG Review',
                bg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
                dot: 'bg-cyan-500 animate-pulse',
                desc: 'In technical evaluation with Bids & Awards Committee TWG.',
            };
        case 'TWG_RETURNED':
            return {
                label: 'Returned by TWG',
                bg: 'bg-rose-100 text-rose-800 border-rose-300',
                dot: 'bg-rose-500',
                desc: 'Returned by Technical Working Group with findings.',
            };
        case 'READY_TO_PRINT':
            return {
                label: 'Ready to Print',
                bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm',
                dot: 'bg-emerald-500',
                desc: 'Fully reviewed and approved by all authorities. Ready for official printing.',
            };
        default:
            return {
                label: status,
                bg: 'bg-gray-100 text-gray-700 border-gray-300',
                dot: 'bg-gray-400',
                desc: '',
            };
    }
};

export const PPMP_STATUS_OPTIONS = [
    { value: 'DRAFT', label: 'Draft', group: 'Initial & Office Endorsement' },
    { value: 'HEAD_PENDING', label: 'Pending Head Approval', group: 'Initial & Office Endorsement' },
    { value: 'HEAD_APPROVED', label: 'Head Endorsed', group: 'Initial & Office Endorsement' },
    { value: 'HEAD_RETURNED', label: 'Returned by Head', group: 'Initial & Office Endorsement' },
    { value: 'TWG_REVIEW', label: 'BAC-TWG Review', group: '1st Stage: Technical Review (BAC-TWG)' },
    { value: 'TWG_RETURNED', label: 'Returned by TWG', group: '1st Stage: Technical Review (BAC-TWG)' },
    { value: 'BUDGET_OFFICER_REVIEW', label: 'Budget Officer Review', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'BUDGET_OFFICER_RETURNED', label: 'Returned by Budget Officer', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'BUDGET_HEAD_REVIEW', label: 'Budget Head Review', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'BUDGET_HEAD_RETURNED', label: 'Returned by Budget Head', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'PACCO_REVIEW', label: 'PACCO Review', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'PACCO_RETURNED', label: 'Returned by PACCO', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'PACCO_HEAD_REVIEW', label: 'PACCO Head Review', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'PACCO_HEAD_RETURNED', label: 'Returned by PACCO Head', group: '2nd Stage: Budget / PACCO Review' },
    { value: 'OPPMO_REVIEW', label: 'OPPMO Review', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'OPPMO_RETURNED', label: 'Returned by OPPMO', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'OPPMO_HEAD_REVIEW', label: 'OPPMO Head Review', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'OPPMO_HEAD_RETURNED', label: 'Returned by OPPMO Head', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'APP_PREPARER_REVIEW', label: 'APP Preparer Review', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'APP_PREPARER_RETURNED', label: 'Returned by APP Preparer', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'GOVERNOR_REVIEW', label: 'Governor Approval Review', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'GOVERNOR_RETURNED', label: 'Returned by Governor', group: '3rd Stage: OPPMO & Final Signatories' },
    { value: 'READY_TO_PRINT', label: 'Ready to Print', group: 'Finalized' },
];

export const StatusBadge = ({ status, showDot = true, onEditStatus = null }) => {
    const config = getStatusConfig(status);

    if (typeof onEditStatus === 'function') {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onEditStatus();
                }}
                title={`Click to change PPMP status (Current: ${config.label})`}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition hover:ring-2 hover:ring-blue-400/60 hover:brightness-95 cursor-pointer ${config.bg}`}
            >
                {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                <span>{config.label}</span>
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
            </button>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}>
            {showDot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
            {config.label}
        </span>
    );
};
