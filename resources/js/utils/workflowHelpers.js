
export const isAwaitingReceive = (ppmp, user) => {
    if (!ppmp || !user) return false;

    const status = ppmp.status;
    const role = user.role;
    const isAdmin = ['admin', 'super_admin'].includes(role);

    if (ppmp.amendment_status === 'PENDING_APPROVAL') {
        return isAdmin && !ppmp.admin_received_at;
    }

    if (isAdmin) {
        return false;
    }

    if (status === 'HEAD_PENDING') {
        const isTargetHead = (role === 'head' || role === 'authorized_staff') && (user.office_id === ppmp.office_id || !ppmp.office_id);
        return isTargetHead && !ppmp.head_received_at;
    }

    if (status === 'BUDGET_OFFICER_REVIEW') {
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user.id;
        return isAssigned && role === 'budget_officer' && !ppmp.budget_received_at;
    }

    if (status === 'BUDGET_HEAD_REVIEW') {
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        return isTargetHead && !ppmp.budget_head_received_at;
    }

    if (status === 'PACCO_REVIEW') {
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user.id;
        return isAssigned && role === 'pacco' && !ppmp.pacco_received_at;
    }

    if (status === 'PACCO_HEAD_REVIEW') {
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        return isTargetHead && !ppmp.pacco_head_received_at;
    }

    if (status === 'OPPMO_REVIEW') {
        const isAssigned = !ppmp.oppmo_reviewer_id || ppmp.oppmo_reviewer_id === user.id;
        return isAssigned && role === 'oppmo' && !ppmp.oppmo_received_at;
    }

    if (status === 'OPPMO_HEAD_REVIEW') {
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        return isTargetHead && !ppmp.oppmo_head_received_at;
    }

    if (status === 'APP_PREPARER_REVIEW') {
        const isTargetSignatory = !ppmp.current_stage_user_id || Number(user?.id) === Number(ppmp.current_stage_user_id);
        return isTargetSignatory && !ppmp.app_preparer_received_at;
    }

    if (status === 'GOVERNOR_REVIEW') {
        const isTargetSignatory = !ppmp.current_stage_user_id || Number(user?.id) === Number(ppmp.current_stage_user_id);
        return isTargetSignatory && !ppmp.governor_received_at;
    }

    if (status === 'TWG_REVIEW') {
        const isAssigned = !ppmp.twg_reviewer_id || ppmp.twg_reviewer_id === user.id;
        return isAssigned && role === 'twg' && !ppmp.twg_received_at;
    }

    if ([
        'HEAD_APPROVED',
        'READY_TO_PRINT',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'BUDGET_HEAD_RETURNED',
        'PACCO_RETURNED',
        'PACCO_HEAD_RETURNED',
        'OPPMO_RETURNED',
        'OPPMO_HEAD_RETURNED',
        'APP_PREPARER_RETURNED',
        'GOVERNOR_RETURNED',
        'TWG_RETURNED'
    ].includes(status)) {
        const isCreator = ppmp.created_by === user.id;
        return isCreator && !ppmp.enduser_received_at;
    }

    return false;
};

export const getStageReceiptInfo = (ppmp, user) => {
    if (!ppmp) return null;

    const status = ppmp.status;
    const role = user?.role;
    const isAdmin = ['admin', 'super_admin'].includes(role);

    let recipientRole = null;
    let isReceived = false;
    let receivedAt = null;
    let canCurrentUserReceive = false;

    if (ppmp.amendment_status === 'PENDING_APPROVAL') {
        recipientRole = 'Administrator';
        isReceived = Boolean(ppmp.admin_received_at);
        receivedAt = ppmp.admin_received_at;
        canCurrentUserReceive = isAdmin && !isReceived;
    } else if (status === 'HEAD_PENDING') {
        recipientRole = 'Office Head';
        isReceived = Boolean(ppmp.head_received_at);
        receivedAt = ppmp.head_received_at;
        const isTargetHead = (role === 'head' || role === 'authorized_staff') && (user?.office_id === ppmp.office_id || !ppmp.office_id);
        canCurrentUserReceive = isTargetHead && !isAdmin && !isReceived;
    } else if (status === 'BUDGET_OFFICER_REVIEW') {
        const assignedName = ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name;
        recipientRole = assignedName ? `Budget Officer (${assignedName})` : 'Budget Officer';
        isReceived = Boolean(ppmp.budget_received_at);
        receivedAt = ppmp.budget_received_at;
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user?.id;
        canCurrentUserReceive = isAssigned && role === 'budget_officer' && !isAdmin && !isReceived;
    } else if (status === 'BUDGET_HEAD_REVIEW') {
        recipientRole = 'Budget Office Head';
        isReceived = Boolean(ppmp.budget_head_received_at);
        receivedAt = ppmp.budget_head_received_at;
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        canCurrentUserReceive = isTargetHead && !isAdmin && !isReceived;
    } else if (status === 'PACCO_REVIEW') {
        const assignedName = ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name;
        recipientRole = assignedName ? `PACCO Reviewer (${assignedName})` : 'PACCO Reviewer';
        isReceived = Boolean(ppmp.pacco_received_at);
        receivedAt = ppmp.pacco_received_at;
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user?.id;
        canCurrentUserReceive = isAssigned && role === 'pacco' && !isAdmin && !isReceived;
    } else if (status === 'PACCO_HEAD_REVIEW') {
        recipientRole = 'PACCO Head';
        isReceived = Boolean(ppmp.pacco_head_received_at);
        receivedAt = ppmp.pacco_head_received_at;
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        canCurrentUserReceive = isTargetHead && !isAdmin && !isReceived;
    } else if (status === 'OPPMO_REVIEW') {
        const assignedName = ppmp.oppmo_reviewer?.name || ppmp.oppmoReviewer?.name;
        recipientRole = assignedName ? `OPPMO (${assignedName})` : 'OPPMO';
        isReceived = Boolean(ppmp.oppmo_received_at);
        receivedAt = ppmp.oppmo_received_at;
        const isAssigned = !ppmp.oppmo_reviewer_id || ppmp.oppmo_reviewer_id === user?.id;
        canCurrentUserReceive = isAssigned && role === 'oppmo' && !isAdmin && !isReceived;
    } else if (status === 'OPPMO_HEAD_REVIEW') {
        recipientRole = 'OPPMO Head';
        isReceived = Boolean(ppmp.oppmo_head_received_at);
        receivedAt = ppmp.oppmo_head_received_at;
        const isTargetHead = role === 'head' && (!ppmp.current_stage_office_id || Number(user?.office_id) === Number(ppmp.current_stage_office_id));
        canCurrentUserReceive = isTargetHead && !isAdmin && !isReceived;
    } else if (status === 'APP_PREPARER_REVIEW') {
        recipientRole = 'APP Preparer';
        isReceived = Boolean(ppmp.app_preparer_received_at);
        receivedAt = ppmp.app_preparer_received_at;
        const isTargetSignatory = !ppmp.current_stage_user_id || Number(user?.id) === Number(ppmp.current_stage_user_id);
        canCurrentUserReceive = isTargetSignatory && !isAdmin && !isReceived;
    } else if (status === 'GOVERNOR_REVIEW') {
        recipientRole = 'Provincial Governor';
        isReceived = Boolean(ppmp.governor_received_at);
        receivedAt = ppmp.governor_received_at;
        const isTargetSignatory = !ppmp.current_stage_user_id || Number(user?.id) === Number(ppmp.current_stage_user_id);
        canCurrentUserReceive = isTargetSignatory && !isAdmin && !isReceived;
    } else if (status === 'TWG_REVIEW') {
        const assignedName = ppmp.twg_reviewer?.name || ppmp.twgReviewer?.name;
        recipientRole = assignedName ? `BAC-TWG (${assignedName})` : 'TWG';
        isReceived = Boolean(ppmp.twg_received_at);
        receivedAt = ppmp.twg_received_at;
        const isAssigned = !ppmp.twg_reviewer_id || ppmp.twg_reviewer_id === user?.id;
        canCurrentUserReceive = isAssigned && role === 'twg' && !isAdmin && !isReceived;
    } else if ([
        'HEAD_APPROVED',
        'READY_TO_PRINT',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'BUDGET_HEAD_RETURNED',
        'PACCO_RETURNED',
        'PACCO_HEAD_RETURNED',
        'OPPMO_RETURNED',
        'OPPMO_HEAD_RETURNED',
        'APP_PREPARER_RETURNED',
        'GOVERNOR_RETURNED',
        'TWG_RETURNED'
    ].includes(status)) {
        recipientRole = 'End User';
        isReceived = Boolean(ppmp.enduser_received_at);
        receivedAt = ppmp.enduser_received_at;
        const isCreator = user && ppmp.created_by === user.id;
        canCurrentUserReceive = isCreator && !isAdmin && !isReceived;
    }

    if (!recipientRole) return null;

    return {
        recipientRole,
        isReceived,
        receivedAt,
        canCurrentUserReceive,
    };
};

export const getSupplementalKindInfo = (ppmp) => {
    if (!ppmp) {
        return { isSupplemental: false, isContinuation: false, purpose: 'CONTINUATION', specify: '', label: '' };
    }

    const type = ppmp.requested_amendment_type || ppmp.amendment_type;
    const isSupplemental = type === 'SUPPLEMENTAL';

    const isContinuation = Boolean(
        ppmp.is_continuation ||
        ppmp.requested_supplemental_purpose === 'CONTINUATION' ||
        ppmp.supplemental_purpose === 'CONTINUATION' ||
        ppmp.amendment?.requested_supplemental_purpose === 'CONTINUATION' ||
        ppmp.amendment?.supplemental_purpose === 'CONTINUATION'
    );

    const rawPurpose = ppmp.requested_supplemental_purpose ||
        ppmp.supplemental_purpose ||
        ppmp.amendment?.requested_supplemental_purpose ||
        ppmp.amendment?.supplemental_purpose;

    const purpose = isContinuation ? 'CONTINUATION' : (rawPurpose || (isSupplemental ? 'CONTINUATION' : null));

    const specify = ppmp.requested_supplemental_specify ||
        ppmp.supplemental_purpose_specify ||
        ppmp.amendment?.requested_supplemental_specify ||
        ppmp.amendment?.supplemental_purpose_specify ||
        '';

    let label = '';
    if (isSupplemental || isContinuation) {
        if (purpose === 'OTHER') {
            label = specify ? `Other: ${specify}` : 'Other';
        } else {
            label = 'Continuation';
        }
    }

    return {
        isSupplemental,
        isContinuation,
        purpose,
        specify,
        label,
    };
};

export const isInfrastructurePpmp = (ppmp) => {
    if (!ppmp) return false;
    const tracker = String(ppmp.tracking_number || '').toUpperCase();
    if (tracker.includes('INFRA-') || tracker.includes('INFRA')) {
        return true;
    }
    if (Array.isArray(ppmp.items) && ppmp.items.some((item) => /infra/i.test(String(item?.project_type || '')))) {
        return true;
    }
    return false;
};

export const getPpmpProjectTypeLabel = (ppmp) => {
    if (isInfrastructurePpmp(ppmp)) {
        return 'Infrastructure';
    }
    const tracker = String(ppmp?.tracking_number || '').toUpperCase();
    if (tracker.includes('CONSULT')) {
        return 'Consulting Services';
    }
    if (Array.isArray(ppmp?.items) && ppmp.items.some((item) => /consult/i.test(String(item?.project_type || '')))) {
        return 'Consulting Services';
    }
    return 'Goods';
};
