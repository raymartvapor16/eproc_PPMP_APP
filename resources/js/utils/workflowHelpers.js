/**
 * Helper to determine if the currently logged-in user needs to explicitly "Receive"
 * the document before they can open details or act on it.
 *
 * Applicable workflow conditions:
 * 1. PENDING_APPROVAL: Supplemental/Amendment request submitted to Admin (admin_received_at is null)
 * 2. HEAD_PENDING: Office Head has not received (head_received_at is null)
 * 3. BUDGET_OFFICER_REVIEW: Budget Officer has not received (budget_received_at is null)
 * 4. OPPMO_REVIEW: OPPMO has not received (oppmo_received_at is null)
 * 5. TWG_REVIEW: TWG has not received (twg_received_at is null)
 * 6. Returned / Suspended states (HEAD_RETURNED, BUDGET_OFFICER_RETURNED, OPPMO_RETURNED, TWG_RETURNED):
 *    End User (creator) has not received the returned document (enduser_received_at is null)
 * 7. HEAD_APPROVED: End User (creator) has not received the approved PPMP (enduser_received_at is null)
 * 8. READY_TO_PRINT: End User (creator) has not received the fully approved PPMP (enduser_received_at is null)
 */
export const isAwaitingReceive = (ppmp, user) => {
    if (!ppmp || !user) return false;

    const status = ppmp.status;
    const role = user.role;
    const isAdmin = ['admin', 'super_admin'].includes(role);

    // When an End User submits an Amendment / Supplemental request, it routes to Admin for approval
    if (ppmp.amendment_status === 'PENDING_APPROVAL') {
        return isAdmin && !ppmp.admin_received_at;
    }

    if (status === 'HEAD_PENDING') {
        const isTargetHead = (role === 'head' || role === 'authorized_staff') && (user.office_id === ppmp.office_id || !ppmp.office_id);
        return (isTargetHead || isAdmin) && !ppmp.head_received_at;
    }

    if (status === 'BUDGET_OFFICER_REVIEW') {
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user.id || isAdmin;
        return isAssigned && (role === 'budget_officer' || isAdmin) && !ppmp.budget_received_at;
    }

    if (status === 'PACCO_REVIEW') {
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user.id || isAdmin;
        return isAssigned && (role === 'pacco' || isAdmin) && !ppmp.pacco_received_at;
    }

    if (status === 'OPPMO_REVIEW') {
        const isAssigned = !ppmp.oppmo_reviewer_id || ppmp.oppmo_reviewer_id === user.id || isAdmin;
        return isAssigned && (role === 'oppmo' || isAdmin) && !ppmp.oppmo_received_at;
    }

    if (status === 'TWG_REVIEW') {
        const isAssigned = !ppmp.twg_reviewer_id || ppmp.twg_reviewer_id === user.id || isAdmin;
        return isAssigned && (role === 'twg' || isAdmin) && !ppmp.twg_received_at;
    }

    if ([
        'HEAD_APPROVED',
        'READY_TO_PRINT',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'PACCO_RETURNED',
        'OPPMO_RETURNED',
        'TWG_RETURNED'
    ].includes(status)) {
        const isCreator = ppmp.created_by === user.id;
        return (isCreator || isAdmin) && !ppmp.enduser_received_at;
    }

    return false;
};

/**
 * Returns metadata about the current stage's receipt state:
 * - recipientRole: string (e.g. 'Administrator', 'Office Head', 'Budget Officer', 'PACCO Reviewer', 'OPPMO', 'TWG', 'End User')
 * - isReceived: boolean (true if received for current stage)
 * - receivedAt: string | null (timestamp when received)
 * - canCurrentUserReceive: boolean (true if logged in user or admin can click Receive)
 */
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
        canCurrentUserReceive = (isTargetHead || isAdmin) && !isReceived;
    } else if (status === 'BUDGET_OFFICER_REVIEW') {
        const assignedName = ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name;
        recipientRole = assignedName ? `Budget Officer (${assignedName})` : 'Budget Officer';
        isReceived = Boolean(ppmp.budget_received_at);
        receivedAt = ppmp.budget_received_at;
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user?.id || isAdmin;
        canCurrentUserReceive = isAssigned && (role === 'budget_officer' || isAdmin) && !isReceived;
    } else if (status === 'PACCO_REVIEW') {
        const assignedName = ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name;
        recipientRole = assignedName ? `PACCO Reviewer (${assignedName})` : 'PACCO Reviewer';
        isReceived = Boolean(ppmp.pacco_received_at);
        receivedAt = ppmp.pacco_received_at;
        const isAssigned = !ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user?.id || isAdmin;
        canCurrentUserReceive = isAssigned && (role === 'pacco' || isAdmin) && !isReceived;
    } else if (status === 'OPPMO_REVIEW') {
        const assignedName = ppmp.oppmo_reviewer?.name || ppmp.oppmoReviewer?.name;
        recipientRole = assignedName ? `OPPMO (${assignedName})` : 'OPPMO';
        isReceived = Boolean(ppmp.oppmo_received_at);
        receivedAt = ppmp.oppmo_received_at;
        const isAssigned = !ppmp.oppmo_reviewer_id || ppmp.oppmo_reviewer_id === user?.id || isAdmin;
        canCurrentUserReceive = isAssigned && (role === 'oppmo' || isAdmin) && !isReceived;
    } else if (status === 'TWG_REVIEW') {
        const assignedName = ppmp.twg_reviewer?.name || ppmp.twgReviewer?.name;
        recipientRole = assignedName ? `BAC-TWG (${assignedName})` : 'TWG';
        isReceived = Boolean(ppmp.twg_received_at);
        receivedAt = ppmp.twg_received_at;
        const isAssigned = !ppmp.twg_reviewer_id || ppmp.twg_reviewer_id === user?.id || isAdmin;
        canCurrentUserReceive = isAssigned && (role === 'twg' || isAdmin) && !isReceived;
    } else if ([
        'HEAD_APPROVED',
        'READY_TO_PRINT',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'PACCO_RETURNED',
        'OPPMO_RETURNED',
        'TWG_RETURNED'
    ].includes(status)) {
        recipientRole = 'End User';
        isReceived = Boolean(ppmp.enduser_received_at);
        receivedAt = ppmp.enduser_received_at;
        const isCreator = user && ppmp.created_by === user.id;
        canCurrentUserReceive = (isCreator || isAdmin) && !isReceived;
    }

    if (!recipientRole) return null;

    return {
        recipientRole,
        isReceived,
        receivedAt,
        canCurrentUserReceive,
    };
};

/**
 * Helper to get the Supplemental Kind information for display in badges and request listings.
 * Resolves whether the supplemental request or child PPMP is 'For continuation' or 'Other: [specify]'.
 */
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
