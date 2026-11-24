export const SYSTEM_ROLE_OPTIONS = [
    { value: 'end_user', label: 'End User (Preparer)', shortLabel: 'End User', desc: 'Create, edit, and submit PPMPs & Detailed Specifications' },
    { value: 'head', label: 'Office Head / Approver', shortLabel: 'Office Head', desc: 'Review and endorse office PPMPs' },
    { value: 'authorized_staff', label: 'Authorize Staff', shortLabel: 'Authorize Staff', desc: 'Authorized representative staff for office submissions' },
    { value: 'budget_officer', label: 'Budget Officer', shortLabel: 'Budget Officer', desc: 'Review budgetary requirements & fund allocations' },
    { value: 'oppmo', label: 'OPPMO Reviewer', shortLabel: 'OPPMO Reviewer', desc: 'Procurement review, APP generation & consolidation' },
    { value: 'twg', label: 'BAC-TWG Reviewer', shortLabel: 'BAC-TWG Reviewer', desc: 'Technical Working Group review of specifications' },
    { value: 'pacco', label: 'PACCO Reviewer (Provincial Accounting)', shortLabel: 'PACCO Reviewer', desc: 'Provincial Accounting Office review (Trust Funds)' },
    { value: 'admin', label: 'Administrator', shortLabel: 'Administrator', desc: 'System administration, user management & reports' },
    { value: 'super_admin', label: 'Super Administrator', shortLabel: 'Super Admin', desc: 'Full executive governance & security controls' },
    { value: 'monitor', label: 'OPPMO Monitor', shortLabel: 'OPPMO Monitor', desc: 'Real-time procurement implementation monitoring' },
    { value: 'pgso', label: 'PGSO Evaluator', shortLabel: 'PGSO Evaluator', desc: 'Supplier performance assessment & evaluation' },
    { value: 'presentative_staff', label: 'Representative Staff', shortLabel: 'Rep. Staff', desc: 'Authorized department representative' },
];

export const REGISTRATION_ROLE_OPTIONS = SYSTEM_ROLE_OPTIONS.filter((r) =>
    ['end_user', 'head', 'authorized_staff', 'budget_officer', 'oppmo', 'twg', 'pacco', 'admin'].includes(r.value)
);

export const getRoleInfo = (roleKey) => {
    const found = SYSTEM_ROLE_OPTIONS.find((r) => r.value === roleKey);
    if (found) return found;
    const formatted = String(roleKey || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
        value: roleKey,
        label: formatted || 'User',
        shortLabel: formatted || 'User',
        desc: 'System role perspective',
    };
};
