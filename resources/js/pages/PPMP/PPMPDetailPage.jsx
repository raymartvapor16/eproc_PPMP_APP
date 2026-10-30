import React, { useState, useEffect } from 'react';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PPMPPrintView } from '../../components/PPMP/PPMPPrintView';
import { PPMPAttachmentListView } from '../../components/PPMP/PPMPAttachmentListView';
import { APPPrintView } from '../../components/PPMP/APPPrintView';
import { PPMPRoutingPrintView } from '../../components/PPMP/PPMPRoutingPrintView';
import { ProcurementPlanTable } from '../../components/PPMP/ProcurementPlanTable';
import { SignatureSection } from '../../components/PPMP/SignatureSection';
import { AttachmentUploader } from '../../components/Attachments/AttachmentUploader';
import { RoutingTimeline } from '../../components/RoutingTimeline/RoutingTimeline';
import { ReviewPanel } from '../../components/Review/ReviewPanel';
import { ppmpService } from '../../services/api';
import { isAwaitingReceive, getStageReceiptInfo } from '../../utils/workflowHelpers';
import {
    ArrowLeft,
    Send,
    Edit3,
    Printer,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Building2,
    Calendar,
    Coins,
    ShieldCheck,
    Maximize2,
    X,
    Eye,
    Inbox,
    Loader2,
    FileSpreadsheet,
    FileText,
    FileUp,
    RefreshCw,
    Clock,
    ChevronDown,
    ChevronUp,
    History,
    Download,
} from 'lucide-react';

const getRoleDisplayName = (role) => {
    switch (role) {
        case 'end_user': return 'End User / Project In-Charge';
        case 'head': return 'Department / Office Head';
        case 'authorized_staff': return 'Authorized Staff (Acting Head)';
        case 'budget_officer': return 'Provincial Budget Officer';
        case 'oppmo': return 'OPPMO / BAC Secretariat';
        case 'twg': return 'BAC-TWG Evaluator';
        case 'pacco': return 'PACCO Reviewer';
        case 'monitor': return 'OPPMO Monitoring Officer';
        case 'super_admin': return 'Super Administrator';
        case 'admin': return 'Administrator';
        default: return role ? role.replace(/_/g, ' ').toUpperCase() : 'Reviewer';
    }
};

const getLatestSuspension = (ppmp, isSuspended) => {
    if (!isSuspended || !ppmp) return null;

    // 1. Backend calculated attribute
    if (ppmp.latest_return_remarks && ppmp.latest_return_remarks.remarks) {
        return {
            remarks: ppmp.latest_return_remarks.remarks,
            reviewerName: ppmp.latest_return_remarks.reviewer_name || null,
            roleLabel: getRoleDisplayName(ppmp.latest_return_remarks.reviewer_role),
            date: ppmp.latest_return_remarks.acted_at || null,
        };
    }

    // 2. Reviews relation
    const returnReviews = (ppmp.reviews || [])
        .filter(r => r.action === 'return' || (r.status_after && r.status_after.includes('RETURNED')))
        .sort((a, b) => new Date(b.acted_at || b.created_at || 0) - new Date(a.acted_at || a.created_at || 0));

    if (returnReviews.length > 0 && returnReviews[0].remarks) {
        const rev = returnReviews[0];
        return {
            remarks: rev.remarks,
            reviewerName: rev.reviewer?.name || null,
            roleLabel: getRoleDisplayName(rev.reviewer_role),
            date: rev.acted_at || rev.created_at || null,
        };
    }

    // 3. Routes relation
    const returnRoutes = (ppmp.routes || [])
        .filter(r => (r.action && r.action.includes('RETURNED')) || (r.status && r.status.includes('RETURNED')))
        .sort((a, b) => new Date(b.acted_at || b.submitted_at || b.created_at || 0) - new Date(a.acted_at || a.submitted_at || a.created_at || 0));

    if (returnRoutes.length > 0 && returnRoutes[0].remarks) {
        const route = returnRoutes[0];
        return {
            remarks: route.remarks,
            reviewerName: route.from_user?.name || null,
            roleLabel: getRoleDisplayName(route.from_role),
            date: route.acted_at || route.submitted_at || route.created_at || null,
        };
    }

    // 4. Status-based fallback
    let fallbackRole = 'Reviewer';
    if (ppmp.status === 'HEAD_RETURNED') fallbackRole = 'Department / Office Head';
    else if (ppmp.status === 'BUDGET_OFFICER_RETURNED') fallbackRole = 'Provincial Budget Officer';
    else if (ppmp.status === 'PACCO_RETURNED') fallbackRole = 'PACCO Reviewer';
    else if (ppmp.status === 'OPPMO_RETURNED') fallbackRole = 'OPPMO / BAC Secretariat';
    else if (ppmp.status === 'TWG_RETURNED') fallbackRole = 'BAC-TWG Evaluator';

    return {
        remarks: ppmp.remarks || 'This procurement plan has been returned/suspended for revision. Please review your line items and attachments before resubmitting.',
        reviewerName: null,
        roleLabel: fallbackRole,
        date: ppmp.updated_at || null,
    };
};

export const PPMPDetailPage = ({
    ppmp,
    user,
    onBack,
    onEdit,
    onReload,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [isPrintView, setIsPrintView] = useState(false);
    const [isAttachmentListView, setIsAttachmentListView] = useState(false);
    const [selectedAttachmentItemId, setSelectedAttachmentItemId] = useState(null);
    const [isAppView, setIsAppView] = useState(false);
    const [selectedAppPpmp, setSelectedAppPpmp] = useState(null);
    const [isRoutingPrintView, setIsRoutingPrintView] = useState(false);
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('overview'); // overview, attachments, timeline
    const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
    const [scopePpmpApp, setScopePpmpApp] = useState(true);
    const [scopeAttachmentList, setScopeAttachmentList] = useState(false);
    const [amendType, setAmendType] = useState('SUPPLEMENTAL'); // SUPPLEMENTAL or AMENDMENT
    const [amendReason, setAmendReason] = useState('');
    const [amendFile, setAmendFile] = useState(null);
    const [submittingAmend, setSubmittingAmend] = useState(false);
    const [amendError, setAmendError] = useState('');
    const [approvingAmend, setApprovingAmend] = useState(false);
    const [rejectingAmend, setRejectingAmend] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const [expandedPpmpIds, setExpandedPpmpIds] = useState({});
    const [selectedReviewPpmp, setSelectedReviewPpmp] = useState(null);
    const [selectedPrintPpmp, setSelectedPrintPpmp] = useState(null);
    const [selectedRoutingPpmp, setSelectedRoutingPpmp] = useState(null);
    const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);

    const togglePpmpExpanded = (id) => {
        setExpandedPpmpIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Array of all historical ancestor PPMPs: uses ppmp.history if returned, otherwise walks parent chain or falls back to [ppmp.parent]
    const historicalPpmps = React.useMemo(() => {
        if (Array.isArray(ppmp?.history) && ppmp.history.length > 0) {
            return ppmp.history;
        }
        const list = [];
        let curr = ppmp?.parent;
        while (curr) {
            list.push(curr);
            curr = curr.parent;
        }
        return list;
    }, [ppmp]);

    // Find the Request Letter for Supplemental / Amendment (from current PPMP or parent/ancestor PPMPs)
    const requestLetterInfo = React.useMemo(() => {
        // Collect candidate PPMPs: active ppmp followed by ancestors
        const candidates = [ppmp, ...historicalPpmps].filter(Boolean);

        for (const candidate of candidates) {
            const hasReason = Boolean(candidate.requested_amendment_reason || candidate.amendment_reason);
            const hasAmendStatus = Boolean(candidate.amendment_status || candidate.requested_amendment_type || candidate.amendment_type);
            if (!hasReason && !hasAmendStatus) continue;

          
            const getAttachmentFrom = (c) => {
                const atts = c.attachments || [];
                if (atts.length === 0) return null;

                // Priority 1: Explicitly tagged REQUEST_LETTER
                let match = atts.find(a => a.attachment_type === 'REQUEST_LETTER');
                if (match) return match;

                // Priority 2: Mentioned in route remarks
                const allRoutes = [...(c.routes || []), ...(candidate.routes || [])];
                const reqRoute = allRoutes.find(r => r.remarks && r.remarks.includes('Attached Letter:'));
                if (reqRoute && reqRoute.remarks) {
                    const m = reqRoute.remarks.match(/Attached Letter:\s*([^\n\r]+)/i);
                    if (m && m[1]) {
                        const filename = m[1].trim();
                        match = atts.find(a => a.original_filename === filename);
                        if (match) return match;
                    }
                }

                // Priority 3: Latest PDF
                const pdfs = atts.filter(a => a.mime_type === 'application/pdf' || a.original_filename?.toLowerCase().endsWith('.pdf'));
                if (pdfs.length > 0) return pdfs[pdfs.length - 1];

                return atts[atts.length - 1];
            };

            let letterAtt = getAttachmentFrom(candidate);
            let attSourcePpmp = candidate;

            if (!letterAtt) {
                // If current candidate has no attachments, look through ancestor candidates
                for (const otherCandidate of candidates) {
                    const found = getAttachmentFrom(otherCandidate);
                    if (found) {
                        letterAtt = found;
                        attSourcePpmp = otherCandidate;
                        break;
                    }
                }
            }

            const type = candidate.requested_amendment_type || candidate.amendment_type || (candidate.parent_id ? 'SUPPLEMENTAL' : null);
            const reason = candidate.requested_amendment_reason || candidate.amendment_reason;
            const requestedAt = candidate.amendment_requested_at || candidate.created_at;

            if (reason || letterAtt || type) {
                return {
                    sourcePpmp: candidate,
                    attSourcePpmp: attSourcePpmp || candidate,
                    type: type === 'AMENDMENT' ? 'Amendment' : 'Supplemental',
                    reason: reason || 'No specific justification stated.',
                    requestedAt,
                    attachment: letterAtt,
                };
            }
        }

        return null;
    }, [ppmp, historicalPpmps]);

    useEffect(() => {
        const handleDataReload = (e) => {
            if (!e.detail?.ppmpUuid || e.detail?.ppmpUuid === ppmp?.uuid) {
                if (onReload) onReload();
            }
        };
        window.addEventListener('app:data_reload', handleDataReload);
        return () => window.removeEventListener('app:data_reload', handleDataReload);
    }, [ppmp?.uuid, onReload]);

    const handleReceiveDocument = async () => {
        setReceiving(true);
        try {
            await ppmpService.receive(ppmp.uuid);
            onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to receive document.');
        } finally {
            setReceiving(false);
        }
    };

    const procurementItems = React.useMemo(() => {
        return (ppmp?.items || []).filter(item => !item.is_header && item.description && item.description.trim() !== '');
    }, [ppmp?.items]);

    const hasAttachmentList = Boolean(
        ppmp?.attachment_list_data ||
        ppmp?.pre_submission_checks?.attachment_list_generated ||
        localStorage.getItem(`ppmp_attachment_generated_${ppmp?.uuid}`)
    );

    const hasApp = Boolean(
        !ppmp?.app_data?.needs_regeneration && (
            ppmp?.app_data?.is_generated ||
            (Array.isArray(ppmp?.app_data?.rows) && ppmp?.app_data?.rows.length > 0)
        )
    );

    const oldAppData = ppmp?.app_data?.old_app || ppmp?.parent?.app_data || null;
    const hasOldApp = Boolean(oldAppData && (oldAppData.rows || oldAppData.is_generated || (typeof oldAppData === 'object' && Object.keys(oldAppData).length > 0)));

    const oldAppPpmp = React.useMemo(() => {
        if (!oldAppData) return null;
        return {
            ...ppmp,
            title: `${ppmp.title} (Previous / Baseline APP)`,
            app_data: oldAppData,
            items: ppmp.parent?.items || ppmp.items,
        };
    }, [ppmp, oldAppData]);

    const hasMarketScoping = Boolean(
        ppmp?.pre_submission_checks?.market_scoping_attached ??
        (ppmp?.attachments || []).some(a =>
            (a.attachment_type === 'MARKET_SCOPING' ||
             (a.file_name && /market.*scoping|scoping/i.test(a.file_name))) &&
            (a.mime_type === 'application/pdf' || (a.file_name && a.file_name.toLowerCase().endsWith('.pdf')))
        )
    );

    const preSubmissionStatus = {
        hasApp: hasApp,
        hasAttachmentList: Boolean(ppmp?.pre_submission_checks?.attachment_list_generated ?? hasAttachmentList),
        hasMarketScoping: hasMarketScoping,
    };
    const isPreSubmissionReady = preSubmissionStatus.hasAttachmentList && preSubmissionStatus.hasMarketScoping;

    const isAttachmentOnly = Boolean(
        ppmp?.amendment_scope === 'ATTACHMENT_LIST' ||
        ppmp?.amendment?.amendment_scope === 'ATTACHMENT_LIST' ||
        ppmp?.requested_amendment_scope === 'ATTACHMENT_LIST'
    );

    const isTwgSkipped = Boolean(
        ppmp?.amendment_scope === 'PPMP_APP' ||
        ppmp?.amendment?.amendment_scope === 'PPMP_APP'
    );
    const isTwgDone = Boolean(isTwgSkipped || ppmp?.twg_approved_at || ppmp?.signatures?.some(s => s.role === 'twg'));
    const isOppmoReviewer = user?.role === 'oppmo' || ['admin', 'super_admin'].includes(user?.role);
    const isOppmoPostTwgReview = isOppmoReviewer && isTwgDone && ppmp?.status === 'OPPMO_REVIEW';
    const canOppmoGenerateApp = isOppmoPostTwgReview && !isAttachmentOnly;

    // View APP is visible:
    // 1) After the OPPMO Reviewer has approved the PPMP and status is HEAD_PENDING or READY_TO_PRINT
    // 2) Or when scope is ATTACHMENT_LIST, the existing approved Annual Procurement Plan (APP) remains valid and unchanged
    const isOppmoAppApproved = Boolean(
        hasApp &&
        (
            (
                ['HEAD_PENDING', 'READY_TO_PRINT'].includes(ppmp?.status) &&
                (
                    ppmp?.status === 'READY_TO_PRINT' ||
                    ppmp?.app_data?.is_oppmo_approved ||
                    ppmp?.app_data?.oppmo_approved_at ||
                    ppmp?.routes?.some(r => r.action === 'OPPMO_APP_GENERATED') ||
                    isTwgDone
                )
            ) ||
            isAttachmentOnly
        )
    );
    const canViewApprovedApp = isOppmoAppApproved;

    const isCreator = ppmp.created_by === user.id;
    const isReadyToPrint = ppmp.status === 'READY_TO_PRINT';

    // Reviewer edit permission
    const isReviewerEditable = (
        ((user.role === 'head' || user.role === 'authorized_staff') && ['HEAD_PENDING', 'HEAD_APPROVED'].includes(ppmp.status) && user.office_id === ppmp.office_id) ||
        (user.role === 'budget_officer' && ppmp.status === 'BUDGET_OFFICER_REVIEW') ||
        (user.role === 'pacco' && ppmp.status === 'PACCO_REVIEW') ||
        (user.role === 'oppmo' && ppmp.status === 'OPPMO_REVIEW') ||
        (user.role === 'twg' && ppmp.status === 'TWG_REVIEW')
    );

    // End user submission permissions:
    // Flow: Budget / PACCO -> OPPMO -> TWG -> Office Head -> Ready to Print
    const canSubmitToHead = false;
    const canSubmitForReview = isCreator && (
        ppmp.status === 'DRAFT' ||
        ppmp.status === 'HEAD_RETURNED' ||
        ppmp.status === 'BUDGET_OFFICER_RETURNED' ||
        ppmp.status === 'PACCO_RETURNED' ||
        ppmp.status === 'OPPMO_RETURNED' ||
        ppmp.status === 'TWG_RETURNED' ||
        ppmp.status === 'HEAD_APPROVED'
    );

    const canEdit = (isCreator && [
        'DRAFT',
        'HEAD_PENDING',
        'HEAD_APPROVED',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'PACCO_RETURNED',
        'OPPMO_RETURNED',
        'TWG_RETURNED'
    ].includes(ppmp.status)) || isReviewerEditable || ['admin', 'super_admin'].includes(user.role);

    if (isPrintView) {
        return <PPMPPrintView ppmp={ppmp} onBack={() => setIsPrintView(false)} />;
    }

    if (selectedPrintPpmp) {
        return <PPMPPrintView ppmp={selectedPrintPpmp} onBack={() => setSelectedPrintPpmp(null)} />;
    }

    if (selectedAppPpmp) {
        return (
            <APPPrintView
                ppmp={selectedAppPpmp}
                user={user}
                canEdit={false}
                onBack={() => setSelectedAppPpmp(null)}
            />
        );
    }

    if (isAppView) {
        return (
            <APPPrintView
                ppmp={ppmp}
                user={user}
                canEdit={isOppmoReviewer && canOppmoGenerateApp}
                onBack={() => setIsAppView(false)}
                onGenerated={(updatedPpmp) => {
                    if (onReload) onReload();
                }}
            />
        );
    }

    if (isRoutingPrintView) {
        return (
            <PPMPRoutingPrintView
                ppmp={selectedRoutingPpmp || ppmp}
                onBack={() => {
                    setIsRoutingPrintView(false);
                    setSelectedRoutingPpmp(null);
                }}
            />
        );
    }

    if (isAttachmentListView) {
        return (
            <PPMPAttachmentListView
                ppmp={ppmp}
                user={user}
                canEdit={canEdit}
                initialItemId={selectedAttachmentItemId}
                onBack={() => {
                    setIsAttachmentListView(false);
                    setSelectedAttachmentItemId(null);
                }}
                onGenerated={(updatedPpmp) => {
                    if (onReload) onReload();
                }}
            />
        );
    }

    // STRICT RULE: Only the end-user (creator) can attach PDF/pictures. Reviewers cannot attach files.
    // Allowed when in DRAFT, before formal review (HEAD_PENDING, HEAD_APPROVED), or when suspended/returned
    const canUploadAttachment = (isCreator && [
        'DRAFT',
        'HEAD_PENDING',
        'HEAD_APPROVED',
        'HEAD_RETURNED',
        'BUDGET_OFFICER_RETURNED',
        'PACCO_RETURNED',
        'OPPMO_RETURNED',
        'TWG_RETURNED'
    ].includes(ppmp.status)) || ['admin', 'super_admin'].includes(user.role);

    const handleSubmitToHead = async () => {
        if (!window.confirm('Submit this PPMP to your Office Head for official endorsement and approval?')) return;
        setSubmitting(true);
        try {
            await ppmpService.submitToHead(ppmp.uuid);
            onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit to Office Head.');
        } finally {
            setSubmitting(false);
        }
    };

    const isTrustFund = Boolean(
        (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
        ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
    );

    const getReviewTargetName = (status) => {
        if (ppmp?.amendment_scope === 'ATTACHMENT_LIST') {
            return 'the BAC-TWG';
        }
        switch (status) {
            case 'PACCO_RETURNED':
                return 'the PACCO Reviewer';
            case 'OPPMO_RETURNED':
                return 'the OPPMO';
            case 'TWG_RETURNED':
                return 'the BAC-TWG';
            case 'BUDGET_OFFICER_RETURNED':
                return 'the Provincial Budget Officer';
            case 'HEAD_RETURNED':
                return 'the Office Head';
            case 'DRAFT':
            case 'HEAD_APPROVED':
            default:
                return isTrustFund ? 'the PACCO Reviewer' : 'the Provincial Budget Officer';
        }
    };

    const isSuspended = ['HEAD_RETURNED', 'BUDGET_OFFICER_RETURNED', 'PACCO_RETURNED', 'OPPMO_RETURNED', 'TWG_RETURNED'].includes(ppmp?.status) || (typeof ppmp?.status === 'string' && ppmp.status.endsWith('_RETURNED'));
    const latestSuspension = getLatestSuspension(ppmp, isSuspended);

    const handleSubmitForReview = async () => {
        if (isAwaitingReceive(ppmp, user)) {
            alert('Please click "Receive Document" to formally acknowledge receipt before submitting for review.');
            return;
        }

        // Validate Pre-Submission Requirements before submitting to the first reviewer
        const missingRequirements = [];
        if (!preSubmissionStatus.hasAttachmentList) {
            missingRequirements.push('• PPMP List of Attachment must already be generated.');
        }
        if (!preSubmissionStatus.hasMarketScoping) {
            missingRequirements.push('• Market Scoping PDF document must already be uploaded and attached.');
        }

        if (missingRequirements.length > 0) {
            alert(
                'Submission Incomplete:\n\n' +
                'Before submitting this PPMP to the reviewer, the following requirements must be completed:\n\n' +
                missingRequirements.join('\n') +
                '\n\nPlease generate the required attachment list and attach the Market Scoping PDF before submitting.'
            );
            return;
        }

        const targetReviewer = getReviewTargetName(ppmp.status);
        const confirmMsg = ppmp.status === 'DRAFT'
            ? `Submit this PPMP for formal government procurement review? This will route directly to ${targetReviewer}.`
            : (ppmp.status === 'HEAD_RETURNED'
                ? `Resubmit this PPMP to the Office Head for endorsement?`
                : `Resubmit this PPMP for review? This will route directly to ${targetReviewer}.`);

        if (!window.confirm(confirmMsg)) return;
        setSubmitting(true);
        try {
            await ppmpService.submitForReview(ppmp.uuid);
            onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit for review.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenAmendModal = () => {
        setScopePpmpApp(true);
        setScopeAttachmentList(false);
        setAmendType('SUPPLEMENTAL');
        setAmendReason('');
        setAmendFile(null);
        setAmendError('');
        setIsAmendModalOpen(true);
    };

    const handleAmendSubmit = async (e) => {
        e.preventDefault();
        setAmendError('');

        if (!scopePpmpApp && !scopeAttachmentList) {
            setAmendError('Please select at least one component to update (PPMP / APP or PPMP List of Attachment).');
            return;
        }

        if (!amendReason.trim()) {
            setAmendError('Please provide a valid justification or reason for this request.');
            return;
        }

        if (!amendFile) {
            setAmendError('Please attach the official Letter of Request (PDF).');
            return;
        }

        if (amendFile.type !== 'application/pdf' && !amendFile.name.toLowerCase().endsWith('.pdf')) {
            setAmendError('Only PDF files are accepted for the request letter.');
            return;
        }

        let requestScope = 'ALL';
        if (scopePpmpApp && !scopeAttachmentList) {
            requestScope = 'PPMP_APP';
        } else if (!scopePpmpApp && scopeAttachmentList) {
            requestScope = 'ATTACHMENT_LIST';
        }

        const formData = new FormData();
        formData.append('request_scope', requestScope);
        formData.append('request_type', scopePpmpApp ? amendType : 'AMENDMENT');
        formData.append('reason', amendReason.trim());
        formData.append('letter_file', amendFile);

        setSubmittingAmend(true);
        try {
            const res = await ppmpService.requestAmendmentOrSupplemental(ppmp.uuid, formData);
            alert(res.data.message || 'Request submitted successfully.');
            setIsAmendModalOpen(false);
            if (onReload) onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            setAmendError(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSubmittingAmend(false);
        }
    };

    const handleApproveAmendment = async () => {
        const typeLabel = ppmp.amendment_type === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment';
        if (!window.confirm(`Approve this ${typeLabel} request?\n\nThis will mark the current PPMP as baseline, create a revision in DRAFT retaining PPMP No. "${ppmp.ppmp_number}" for manual editing, and reopen it for modifications.`)) {
            return;
        }

        setApprovingAmend(true);
        try {
            const res = await ppmpService.approveAmendment(ppmp.uuid);
            alert(res.data.message || `${typeLabel} request approved. New PPMP created in DRAFT.`);
            if (res.data?.ppmp?.uuid && onReload) {
                // If onReload accepts uuid, or reload caller
                onReload(res.data.ppmp.uuid);
            } else if (onReload) {
                onReload();
            }
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve request.');
        } finally {
            setApprovingAmend(false);
        }
    };

    const handleRejectAmendmentSubmit = async (e) => {
        e.preventDefault();
        if (!rejectRemarks.trim()) {
            alert('Please provide a reason or remarks for disapproval.');
            return;
        }

        setRejectingAmend(true);
        try {
            const res = await ppmpService.rejectAmendment(ppmp.uuid, { remarks: rejectRemarks.trim() });
            alert(res.data.message || 'Request disapproved.');
            setShowRejectModal(false);
            setRejectRemarks('');
            if (onReload) onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to disapprove request.');
        } finally {
            setRejectingAmend(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base font-extrabold text-slate-900 font-mono flex items-center gap-1.5">
                                PPMP No. {ppmp.ppmp_number}
                                {!ppmp.parent_id ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-tight uppercase border bg-blue-100 text-blue-800 border-blue-300">
                                        Annual
                                    </span>
                                ) : (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-tight uppercase border ${ppmp.amendment_type === 'AMENDMENT'
                                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        }`}>
                                        {ppmp.amendment_type === 'AMENDMENT' ? 'Amended' : 'Supplemental'}
                                    </span>
                                )}
                            </h1>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-300" title="Tracking Number">
                                Tracker No.: {ppmp.tracking_number || ppmp.ppmp_number}
                            </span>
                            <StatusBadge status={ppmp.status} />
                            {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-100 text-amber-900 border-amber-300 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                    Pending {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'} Approval
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 truncate max-w-md">
                            {ppmp.title}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Explicit Receive Document Button if user hasn't received it yet */}
                    {isAwaitingReceive(ppmp, user) && (
                        <button
                            disabled={receiving}
                            onClick={handleReceiveDocument}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                            title="Acknowledge formal receipt of this document in your office/workflow queue"
                        >
                            {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
                            Receive Document
                        </button>
                    )}

                    {/* OPPMO Reviewer Generate/Regenerate APP Action Button (Only after TWG review is complete) */}
                    {canOppmoGenerateApp && (
                        <button
                            type="button"
                            onClick={() => setIsAppView(true)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer ${
                                ppmp?.app_data?.needs_regeneration
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                    : hasApp
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            title="Generate or update Annual Procurement Plan (APP)"
                        >
                            <FileText className="w-4 h-4" />
                            {ppmp?.app_data?.needs_regeneration ? 'Regenerate APP' : (hasApp ? 'View / Edit APP' : 'Generate APP')}
                        </button>
                    )}

                    {/* READY_TO_PRINT Action Buttons */}
                    {isReadyToPrint && (
                        <>
                            {ppmp.amendment_status === 'PENDING_APPROVAL' ? (
                                <span className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'} Pending Admin Approval
                                </span>
                            ) : (
                                (user?.role === 'end_user' && isCreator) ? (
                                    <button
                                        onClick={handleOpenAmendModal}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                                        title="Request Supplemental or Amendment for this approved PPMP"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Request Supplemental / Amend
                                    </button>
                                ) : null
                            )}
                            <button
                                onClick={() => setIsPrintView(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                PRINT PPMP
                            </button>
                            {canViewApprovedApp && (
                                <button
                                    onClick={() => setIsAppView(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" />
                                    PRINT APP
                                </button>
                            )}
                            {hasOldApp && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedAppPpmp(oldAppPpmp)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                                    title="View Old / Previous Annual Procurement Plan (APP) baseline before this revision"
                                >
                                    <History className="w-4 h-4" />
                                    OLD APP
                                </button>
                            )}
                            {hasAttachmentList && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAttachmentItemId(null);
                                        setIsAttachmentListView(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                                    title="Open and print PPMP List of Attachment"
                                >
                                    <Printer className="w-4 h-4" />
                                    {procurementItems.length > 1 ? `PRINT ATTACHMENTS (${procurementItems.length})` : 'PRINT ATTACHMENT'}
                                </button>
                            )}
                        </>
                    )}

                    {canEdit && (
                        isAttachmentOnly && !['admin', 'super_admin'].includes(user.role) ? (
                            <button
                                type="button"
                                onClick={() => setIsAttachmentListView(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                                title="PPMP items are locked for this revision. The approved request scope is restricted to the PPMP List of Attachment only. Click to edit List of Attachment."
                            >
                                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                                Edit List of Attachment (Scope Restricted)
                            </button>
                        ) : (
                            <button
                                onClick={onEdit}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit PPMP
                            </button>
                        )
                    )}

                    {canSubmitForReview && (
                        <button
                            disabled={submitting}
                            onClick={handleSubmitForReview}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer ${
                                isPreSubmissionReady
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>
                                        {ppmp.status === 'DRAFT'
                                            ? 'Submit for Review'
                                            : (ppmp.status === 'HEAD_RETURNED'
                                                ? 'Resubmit to Office Head'
                                                : `Resubmit to ${getReviewTargetName(ppmp.status).replace(/^the\s+/i, '')}`)}
                                    </span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Suspension / Return Remarks Banner */}
            {isSuspended && latestSuspension && (
                <div className="pt-3 border-t border-rose-100">
                    <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="p-1 bg-rose-100 text-rose-700 rounded-md">
                                    <AlertTriangle className="w-4 h-4" />
                                </span>
                                <span className="font-bold text-rose-950 uppercase tracking-wide text-[11px]">
                                    Latest Suspension Remarks & Instructions
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200/80 text-rose-900 border border-rose-300">
                                    {latestSuspension.roleLabel}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-rose-700 font-medium">
                                {latestSuspension.reviewerName && (
                                    <span>Reviewer: <strong>{latestSuspension.reviewerName}</strong></span>
                                )}
                                {latestSuspension.date && (
                                    <span className="text-rose-500 font-mono">• {formatDate(latestSuspension.date)}</span>
                                )}
                            </div>
                        </div>
                        <div className="p-3 bg-white border border-rose-200 rounded-lg text-xs text-rose-950 font-medium whitespace-pre-wrap leading-relaxed shadow-2xs">
                            {latestSuspension.remarks}
                        </div>
                    </div>
                </div>
            )}
        </div>

            {/* Mandatory Pre-Submission Checklist Banner for DRAFT and Returned States */}
            {canSubmitForReview && ['DRAFT', 'HEAD_RETURNED', 'BUDGET_OFFICER_RETURNED', 'PACCO_RETURNED', 'OPPMO_RETURNED', 'TWG_RETURNED'].includes(ppmp.status) && (
                <div className={`rounded-xl border-2 p-4 shadow-xs transition ${
                    isPreSubmissionReady
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : 'bg-amber-50/80 border-amber-300'
                }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                isPreSubmissionReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                                {isPreSubmissionReady ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900">
                                        Pre-Submission Document Checklist
                                    </h4>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                        isPreSubmissionReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}>
                                        {isPreSubmissionReady ? 'Ready for Review' : 'Action Required Before Submission'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {isPreSubmissionReady
                                        ? 'All mandatory forms and scoping documents are generated and attached. You may now submit for formal review.'
                                        : 'Before submitting to the reviewer, the PPMP List of Attachment must be generated, and the Market Scoping PDF must be attached.'}
                                </p>
                            </div>
                        </div>

                        {/* Checklist items */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
                            {/* 1. PPMP List of Attachment */}
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                preSubmissionStatus.hasAttachmentList
                                    ? 'bg-emerald-100/60 border-emerald-300 text-emerald-800'
                                    : 'bg-white border-amber-300 text-amber-900'
                            }`}>
                                {preSubmissionStatus.hasAttachmentList ? (
                                    <>
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>Attachment List Generated</span>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedAttachmentItemId(null);
                                            setIsAttachmentListView(true);
                                        }}
                                        className="text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-1.5"
                                        title="Click to generate PPMP List of Attachment"
                                    >
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Generate Attachment List</span>
                                    </button>
                                )}
                            </div>

                            {/* 3. Market Scoping PDF */}
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                preSubmissionStatus.hasMarketScoping
                                    ? 'bg-emerald-100/60 border-emerald-300 text-emerald-800'
                                    : 'bg-white border-amber-300 text-amber-900'
                            }`}>
                                {preSubmissionStatus.hasMarketScoping ? (
                                    <>
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>Market Scoping PDF Attached</span>
                                    </>
                                ) : (
                                    <span className="text-amber-800 font-bold flex items-center gap-1.5">
                                        <FileUp className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Attach Market Scoping PDF</span>
                                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-bold uppercase">Required</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Receipt Alert Banner if current actor hasn't received the incoming document */}
            {isAwaitingReceive(ppmp, user) && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <Inbox className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">
                                Incoming Document Awaiting Receipt
                            </h4>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Please acknowledge formal receipt of this PPMP transaction to log timestamp tracking in the routing slip and enable official actions.
                            </p>
                        </div>
                    </div>
                    <button
                        disabled={receiving}
                        onClick={handleReceiveDocument}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                        {receiving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Receiving Document...</span>
                            </>
                        ) : (
                            <>
                                <Inbox className="w-4 h-4" />
                                <span>Receive Document Now</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Pending Amendment Approval Banner */}
            {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                <div className="bg-amber-50/90 border-2 border-amber-400 rounded-xl p-4 shadow-sm animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                                <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-amber-950">
                                        Pending Administrator Approval: {
                                            (ppmp.requested_amendment_scope || ppmp.amendment_scope) === 'ATTACHMENT_LIST'
                                                ? 'Update PPMP List of Attachment Request'
                                                : ((ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL' ? 'Supplemental Request' : 'Amendment Request')
                                        }
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-200 text-amber-900 rounded">
                                        Awaiting Admin Review
                                    </span>
                                    {/* Scope badge */}
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded">
                                        Scope: {
                                            (ppmp.requested_amendment_scope || ppmp.amendment_scope) === 'ATTACHMENT_LIST'
                                                ? 'Attachment List Only'
                                                : (ppmp.requested_amendment_scope || ppmp.amendment_scope) === 'PPMP_APP'
                                                    ? 'PPMP / APP Only'
                                                    : 'Full PPMP (All Components)'
                                        }
                                    </span>
                                </div>
                                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                    <strong>Justification:</strong> {ppmp.requested_amendment_reason || ppmp.amendment_reason || 'No specific justification provided.'}
                                </p>
                                {ppmp.amendment_requested_at && (
                                    <p className="text-[11px] text-amber-700 mt-1">
                                        Submitted on {formatDate(ppmp.amendment_requested_at)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {['admin', 'super_admin'].includes(user.role) && (
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                                {!ppmp.admin_received_at && (
                                    <button
                                        type="button"
                                        disabled={receiving}
                                        onClick={handleReceiveDocument}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
                                        title="Officially acknowledge receipt of this Supplemental/Amendment request"
                                    >
                                        {receiving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Receiving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Inbox className="w-4 h-4" />
                                                <span>Receive Request</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                {Boolean(ppmp.admin_received_at) && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={approvingAmend}
                                            onClick={handleApproveAmendment}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            {approvingAmend ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Approving...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span>Approve Request</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowRejectModal(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                                        >
                                            <X className="w-4 h-4" />
                                            Disapprove
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Split Grid: Main Document & Side Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left (2 cols): PPMP Form / Items Table */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Header info */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                                        Project Procurement Management Plan
                                    </span>
                                    <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        Tracker No.: {ppmp.tracking_number || ppmp.ppmp_number}
                                    </span>
                                </div>
                                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                                    {ppmp.title}
                                </h2>
                            </div>
                            <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-xs text-slate-800">
                                {ppmp.plan_type}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block">Fiscal Year:</span>
                                <span className="font-bold text-slate-900">CY {ppmp.fiscal_year}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Source of Fund:</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold mt-0.5 ${
                                    isTrustFund
                                        ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                        : 'bg-blue-100 text-blue-900 border border-blue-300'
                                }`}>
                                    {ppmp.source_of_fund || 'General Fund'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Total Budget:</span>
                                <span className="font-mono font-extrabold text-blue-900 text-sm">
                                    {formatCurrency(ppmp.total_budget)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Office / Unit:</span>
                                <span className="font-semibold text-slate-900 truncate block">
                                    {ppmp.implementing_unit || ppmp.office?.name}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500 block">Prepared By:</span>
                                <span className="font-semibold text-slate-900 truncate block">
                                    {ppmp.creator?.name}
                                </span>
                            </div>
                        </div>

                        {/* Current Stage Receipt Status Indicator */}
                        {(() => {
                            const receiptInfo = getStageReceiptInfo(ppmp, user);
                            if (!receiptInfo) return null;

                            return (
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-500">Current Office Receipt:</span>
                                        {receiptInfo.isReceived ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                                Received by {receiptInfo.recipientRole} ({formatDate(receiptInfo.receivedAt)})
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                Awaiting Receipt by {receiptInfo.recipientRole}
                                            </span>
                                        )}
                                    </div>

                                    {receiptInfo.canCurrentUserReceive && (
                                        <button
                                            type="button"
                                            disabled={receiving}
                                            onClick={handleReceiveDocument}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition disabled:opacity-50 cursor-pointer"
                                        >
                                            {receiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Inbox className="w-3.5 h-3.5" />}
                                            Receive Document Now
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Table of Items */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                    Procurement Items & Schedule
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Official 12-column PPMP specifications and budgetary allocation
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsItemsModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold uppercase tracking-wide transition shadow-2xs cursor-pointer"
                                title="Open full screen wide modal for convenient reviewing"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                Review in Full Modal
                            </button>
                        </div>
                        <ProcurementPlanTable
                            items={ppmp.items || []}
                            isEditable={false}
                            totalBudget={ppmp.total_budget}
                            accountCode={ppmp.account_code}
                            programName={ppmp.program_name}
                            deliveryPeriod={ppmp.delivery_period}
                            placeOfDelivery={ppmp.place_of_delivery}
                            paymentMethod={ppmp.payment_method}
                            warrantyAndOtherTerms={ppmp.warranty_and_other_terms}
                        />
                    </div>

                    {/* COLLAPSIBLE / FOLD FEATURE FOR ALL PREVIOUS / HISTORICAL PPMPS */}
                    {historicalPpmps.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5 text-slate-400" />
                                    Previous & Baseline PPMPs ({historicalPpmps.length})
                                </span>
                                {historicalPpmps.length > 5 && (
                                    <span className="text-[11px] font-medium text-slate-400">
                                        Showing latest 5 of {historicalPpmps.length} &bull; scroll down for older
                                    </span>
                                )}
                            </div>

                            <div className={`space-y-3 ${historicalPpmps.length > 5 ? 'max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent' : ''}`}>
                            {historicalPpmps.map((histPpmp) => {
                                const isExpanded = Boolean(expandedPpmpIds[histPpmp.id]);
                                // Only the very first created root PPMP (no parent_id) is the Annual PPMP
                                const isAnnualRoot = !histPpmp.parent_id;
                                const isAmended = histPpmp.amendment_type === 'AMENDMENT';

                                return (
                                    <div
                                        key={histPpmp.id}
                                        className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200"
                                    >
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => togglePpmpExpanded(histPpmp.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    togglePpmpExpanded(histPpmp.id);
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 transition text-left cursor-pointer border-b border-slate-200/60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                                    <History className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                                            {isAnnualRoot ? 'Old / Annual PPMP (Folded Baseline)' : (isAmended ? 'Previous / Amended PPMP (Folded)' : 'Previous / Supplemental PPMP (Folded)')}
                                                        </h3>
                                                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                                                            isAnnualRoot
                                                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                                : isAmended
                                                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                        }`}>
                                                            PPMP No. {histPpmp.ppmp_number} &bull; {isAnnualRoot ? 'Annual' : (isAmended ? 'Amended' : 'Supplemental')}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        {isAnnualRoot ? 'Original approved baseline data' : `${isAmended ? 'Amended' : 'Supplemental'} revision baseline data`} copied into later revisions
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right hidden sm:block">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Baseline Budget</span>
                                                    <span className="font-mono font-bold text-slate-700 text-xs">
                                                        {formatCurrency(histPpmp.total_budget)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedReviewPpmp(histPpmp)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wide transition shadow-2xs cursor-pointer"
                                                        title="Open full screen review modal for this PPMP revision"
                                                    >
                                                        <Maximize2 className="w-3.5 h-3.5" />
                                                        Full Review
                                                    </button>
                                                    {isAnnualRoot ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedAppPpmp(histPpmp)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition shadow-2xs cursor-pointer"
                                                            title="View Old / Annual Procurement Plan (APP)"
                                                        >
                                                            <History className="w-3.5 h-3.5" />
                                                            Old APP
                                                        </button>
                                                    ) : (
                                                        histPpmp.app_data && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedAppPpmp(histPpmp)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition shadow-2xs cursor-pointer"
                                                                title="View Previous Procurement Plan (APP)"
                                                            >
                                                                <History className="w-3.5 h-3.5" />
                                                                Previous APP
                                                            </button>
                                                        )
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPrintPpmp(histPpmp)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition shadow-2xs cursor-pointer"
                                                        title="Print official document for this PPMP revision"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        Print PPMP
                                                    </button>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="p-5 space-y-4 bg-slate-50/50 animate-in fade-in duration-200">
                                                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                                                    <div className="text-slate-600">
                                                        <span className="font-semibold text-slate-900">Project Title: </span>
                                                        {histPpmp.title}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono font-bold text-blue-900">
                                                            Total: {formatCurrency(histPpmp.total_budget)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <ProcurementPlanTable
                                                    items={histPpmp.items || []}
                                                    isEditable={false}
                                                    totalBudget={histPpmp.total_budget}
                                                    accountCode={histPpmp.account_code}
                                                    programName={histPpmp.program_name}
                                                    deliveryPeriod={histPpmp.delivery_period}
                                                    placeOfDelivery={histPpmp.place_of_delivery}
                                                    paymentMethod={histPpmp.payment_method}
                                                    warrantyAndOtherTerms={histPpmp.warranty_and_other_terms}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right (1 col): Review Actions, Attachments, and Routing Timeline */}
                <div className="space-y-6">
                    {/* Reviewer Action Center */}
                    <ReviewPanel
                        ppmp={ppmp}
                        user={user}
                        userRole={user.role}
                        onActionCompleted={onReload}
                        onReceiveDocument={handleReceiveDocument}
                        isReceiving={receiving}
                        onEdit={onEdit}
                        onOpenItemsModal={() => setIsItemsModalOpen(true)}
                        onOpenApp={() => setIsAppView(true)}
                    />

                    {/* Create / Generate PPMP List of Attachment Button */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                                <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                                    PPMP List of Attachment
                                    {procurementItems.length > 1 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono font-semibold">
                                            {procurementItems.length} Items
                                        </span>
                                    )}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                    Official Project Procurement Management Plan List standard form
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedAttachmentItemId(null);
                                setIsAttachmentListView(true);
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer ${hasAttachmentList
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                            title="Generate and view official Project Procurement Management Plan (PPMP) List attachment"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            {hasAttachmentList
                                ? (procurementItems.length > 1 ? `View PPMP Lists of Attachment (${procurementItems.length})` : 'View PPMP List of Attachment')
                                : (procurementItems.length > 1 ? `Create PPMP Lists of Attachment (${procurementItems.length})` : 'Create PPMP List of Attachment')
                            }
                        </button>

                        {/* If multiple procurement rows, display direct links for each item */}
                        {procurementItems.length > 1 && (
                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    Procurement Rows:
                                </div>
                                {procurementItems.map((item, idx) => {
                                    const savedItem = ppmp?.attachment_list_data?.attachment_lists?.[String(item.id || idx)];
                                    const isDone = Boolean(savedItem?.rows?.some(r => r.description || r.qty));
                                    return (
                                        <button
                                            key={item.id || idx}
                                            type="button"
                                            onClick={() => {
                                                setSelectedAttachmentItemId(item.id || idx);
                                                setIsAttachmentListView(true);
                                            }}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 text-slate-700 hover:text-indigo-900 transition flex items-center justify-between text-xs cursor-pointer group"
                                            title={`Open Attachment List for Row #${item.item_no || idx + 1}: ${item.description}`}
                                        >
                                            <div className="truncate flex-1 mr-2 flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-slate-200 group-hover:bg-indigo-200 text-slate-700 group-hover:text-indigo-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-[11px] truncate font-medium">{item.description}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-[10px] font-mono text-slate-500 group-hover:text-indigo-600">
                                                    {formatCurrency(item.estimated_budget || 0)}
                                                </span>
                                                {isDone && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Create / Generate APP (Annual Procurement Plan) Button — Only visible to OPPMO Reviewer during post-TWG OPPMO_REVIEW, or once OPPMO has generated APP and approved the PPMP */}
                    {(canOppmoGenerateApp || canViewApprovedApp) && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-2.5">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                        Annual Procurement Plan (APP)
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Official Province of Davao del Sur Annual Procurement Plan
                                    </p>
                                </div>
                            </div>

                            {/* Action / View Button */}
                            {canOppmoGenerateApp ? (
                                <button
                                    type="button"
                                    onClick={() => setIsAppView(true)}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer ${
                                        ppmp?.app_data?.needs_regeneration
                                            ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                            : hasApp
                                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    title="Configure and generate Official Annual Procurement Plan (APP)"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>
                                        {ppmp?.app_data?.needs_regeneration
                                            ? 'Regenerate APP (Changes Detected)'
                                            : (hasApp ? 'View / Edit APP' : 'Generate APP')}
                                    </span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsAppView(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                                    title={isReadyToPrint ? "Generate and print official Annual Procurement Plan (APP) with Governor Approval" : "View official Annual Procurement Plan (APP) preview"}
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>{isReadyToPrint ? 'View / Print APP' : 'View APP Preview'}</span>
                                </button>
                            )}

                            {hasOldApp && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedAppPpmp(oldAppPpmp)}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer"
                                    title="View Old / Previous Annual Procurement Plan (APP) baseline before this revision"
                                >
                                    <History className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>View Old / Previous APP</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Letter of Request for Supplemental / Amendment Panel (Always on Top of Supporting Documents) */}
                    {requestLetterInfo && (
                        <div className="bg-white rounded-lg border border-amber-300 shadow-sm p-5 bg-gradient-to-br from-amber-50/40 to-white">
                            <div className="flex items-center justify-between pb-3 border-b border-amber-200/80 mb-3.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                                            Letter of Request & Justification
                                        </h3>
                                        <p className="text-[10px] text-amber-700 font-mono">
                                            {requestLetterInfo.type} Request &bull; PPMP No. {requestLetterInfo.sourcePpmp?.ppmp_number}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300 uppercase">
                                    {requestLetterInfo.type}
                                </span>
                            </div>

                            {/* Justification Text */}
                            <div className="p-3 bg-white rounded-lg border border-amber-200/80 text-xs text-slate-700 mb-3">
                                <span className="font-bold text-amber-950 block text-[11px] uppercase tracking-wider mb-1">
                                    Justification / Purpose:
                                </span>
                                <p className="italic text-slate-700 leading-relaxed text-[11px]">
                                    "{requestLetterInfo.reason}"
                                </p>
                                {requestLetterInfo.requestedAt && (
                                    <span className="block text-[10px] text-slate-400 font-mono mt-1.5 text-right">
                                        Submitted on {formatDate(requestLetterInfo.requestedAt)}
                                    </span>
                                )}
                            </div>

                            {/* Attached Official Request Letter File */}
                            {requestLetterInfo.attachment ? (
                                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-amber-400 transition">
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-bold text-slate-900 truncate" title={requestLetterInfo.attachment.original_filename}>
                                                {requestLetterInfo.attachment.original_filename}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono">
                                                {(requestLetterInfo.attachment.file_size / 1024).toFixed(1)} KB &bull; Signed Official PDF
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        <a
                                            href={ppmpService.getAttachmentViewUrl(requestLetterInfo.attSourcePpmp?.uuid || requestLetterInfo.sourcePpmp?.uuid || ppmp.uuid, requestLetterInfo.attachment)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold uppercase tracking-wider transition"
                                            title="View signed letter in new tab"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View
                                        </a>
                                        <a
                                            href={ppmpService.getAttachmentDownloadUrl(requestLetterInfo.attSourcePpmp?.uuid || requestLetterInfo.sourcePpmp?.uuid || ppmp.uuid, requestLetterInfo.attachment)}
                                            download
                                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition"
                                            title="Download signed letter"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50/70 border border-dashed border-amber-300 rounded-lg text-center text-xs text-amber-800 italic">
                                    Letter of request was submitted with this application.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Private Attachments */}
                    <AttachmentUploader
                        ppmp={ppmp}
                        historicalPpmps={historicalPpmps}
                        canUpload={canUploadAttachment}
                        canDelete={canUploadAttachment}
                        onAttachmentChanged={onReload}
                        requestLetterAttachmentId={requestLetterInfo?.attachment?.id || requestLetterInfo?.attachment?.uuid}
                    />





                    {/* Routing History Timeline */}
                    <RoutingTimeline
                        routes={ppmp.routes || []}
                        reviews={ppmp.reviews || []}
                        changeLogs={ppmp.change_logs || []}
                        ppmp={ppmp}
                        historicalPpmps={historicalPpmps}
                        isOpen={isRoutingModalOpen ? true : null}
                        onClose={() => {
                            setIsRoutingModalOpen(false);
                            setSelectedRoutingPpmp(null);
                        }}
                        initialPpmp={selectedRoutingPpmp}
                        onPrint={(targetPpmp) => {
                            const isRealPpmp = targetPpmp && typeof targetPpmp === 'object' && !('nativeEvent' in targetPpmp) && (targetPpmp.uuid || targetPpmp.id);
                            const chosenPpmp = isRealPpmp ? targetPpmp : ppmp;
                            const fullPpmp = {
                                ...chosenPpmp,
                                routes: (chosenPpmp?.routes && chosenPpmp.routes.length > 0) ? chosenPpmp.routes : (ppmp?.routes || []),
                                reviews: (chosenPpmp?.reviews && chosenPpmp.reviews.length > 0) ? chosenPpmp.reviews : (ppmp?.reviews || []),
                                change_logs: (chosenPpmp?.change_logs && chosenPpmp.change_logs.length > 0) ? chosenPpmp.change_logs : (ppmp?.change_logs || []),
                                signatures: (chosenPpmp?.signatures && chosenPpmp.signatures.length > 0) ? chosenPpmp.signatures : (ppmp?.signatures || []),
                                office: chosenPpmp?.office || ppmp?.office,
                                creator: chosenPpmp?.creator || ppmp?.creator,
                            };
                            setSelectedRoutingPpmp(fullPpmp);
                            setIsRoutingPrintView(true);
                        }}
                    />
                </div>
            </div>

            {/* FULL & WIDE MODAL FOR REVIEWING PROCUREMENT ITEMS & SCHEDULE */}
            {isItemsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] max-h-[94vh] flex flex-col border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Top Header */}
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg text-white">
                                    <Maximize2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base font-bold uppercase tracking-wide text-white">
                                            Procurement Items & Schedule — Full Wide Review
                                        </h2>
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-blue-900 text-blue-100 rounded border border-blue-700">
                                            PPMP No. {ppmp.ppmp_number}
                                        </span>
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700" title="Tracking Number">
                                            Tracker No.: {ppmp.tracking_number || ppmp.ppmp_number}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
                                        {ppmp.title}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-4 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Budget</span>
                                        <span className="font-mono font-bold text-amber-400 text-sm">
                                            {formatCurrency(ppmp.total_budget)}
                                        </span>
                                    </div>
                                    <div className="border-l border-slate-700 pl-4">
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Office / Unit</span>
                                        <span className="font-semibold text-slate-200">
                                            {ppmp.office?.name || 'Department'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action button in modal header: Print if READY_TO_PRINT, otherwise Edit PPMP if editable */}
                                {isReadyToPrint ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsItemsModalOpen(false);
                                                setIsPrintView(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                            title="Print official PPMP document"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            Print PPMP
                                        </button>
                                        {canViewApprovedApp && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsItemsModalOpen(false);
                                                    setIsAppView(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                                title="Print official Annual Procurement Plan (APP)"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                Print APP
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        {canViewApprovedApp && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsItemsModalOpen(false);
                                                    setIsAppView(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                                title="View / Print official Annual Procurement Plan (APP)"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                Print APP
                                            </button>
                                        )}
                                        {canEdit && (
                                            isAttachmentOnly && !['admin', 'super_admin'].includes(user.role) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsItemsModalOpen(false);
                                                        setIsAttachmentListView(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                                    title="PPMP items are locked for this revision. The approved request scope is restricted to the PPMP List of Attachment only."
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    Edit List of Attachment
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsItemsModalOpen(false);
                                                        onEdit(ppmp);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                                    title="Edit this PPMP form and items"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    Edit PPMP
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsItemsModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Close modal"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Complete Form Layout matching the Official Print Document */}
                        <div className="p-4 md:p-8 overflow-y-auto overflow-x-auto flex-1 bg-slate-200">
                            <div className="bg-white rounded-lg border border-slate-400 shadow-lg p-6 md:p-8 max-w-[1500px] mx-auto text-black">
                                {/* Top-left Tracker No. */}
                                <div className="text-xs font-mono font-bold text-slate-800 mb-1">
                                    Tracker No.: <span className="font-bold text-black">{ppmp?.tracking_number || ppmp?.ppmp_number || '—'}</span>
                                </div>

                                {/* Official Header with Seal matching Print View */}
                                <table className="w-full border-collapse mb-2">
                                    <tbody>
                                        <tr>
                                            <td className="w-24 text-center align-middle p-1">
                                                <img
                                                    src="/images/logo.png"
                                                    alt="Province of Davao del Sur Official Seal"
                                                    className="w-20 h-20 mx-auto object-contain"
                                                />
                                            </td>
                                            <td className="text-center align-middle p-1">
                                                <div className="text-xs uppercase font-normal tracking-wide leading-tight">Republic of the Philippines</div>
                                                <div className="text-base font-bold uppercase tracking-wider leading-tight">PROVINCIAL GOVERNMENT OF DAVAO DEL SUR</div>
                                                <div className="text-sm font-normal tracking-tight mt-0.5">
                                                    Matti, Digos City
                                                </div>
                                                <div className="text-sm font-bold tracking-tight mt-0.5">
                                                    PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. <span className="font-mono">{ppmp.ppmp_number}</span>
                                                </div>
                                                <div className="flex items-center justify-center gap-10 text-xs font-bold mt-1">
                                                    <label className="flex items-center gap-1.5 cursor-default">
                                                        <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${ppmp.plan_type === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                                            {ppmp.plan_type === 'INDICATIVE' ? '✓' : ''}
                                                        </span>
                                                        <span>INDICATIVE</span>
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-default">
                                                        <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${ppmp.plan_type === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                                            {ppmp.plan_type === 'FINAL' ? '✓' : ''}
                                                        </span>
                                                        <span>FINAL</span>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="w-24"></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Fiscal Year & End-User Subheaders */}
                                <div className="text-xs mb-3 border-b border-black pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold">
                                            Fiscal Year : <span className="font-normal">(CY {ppmp.fiscal_year})</span>
                                        </div>
                                        <div className="font-bold">
                                            Project Title: <span className="font-semibold text-slate-900">{ppmp.title}</span>
                                        </div>
                                    </div>
                                    <div className="font-bold mt-1">
                                        End-User or Implementing Unit: <span className="font-normal uppercase">({ppmp.implementing_unit || ppmp.office?.name || ppmp.title})</span>
                                    </div>
                                </div>

                                {/* Full Procurement Plan Table with 12 Columns & Delivery Rows */}
                                <ProcurementPlanTable
                                    items={ppmp.items || []}
                                    isEditable={false}
                                    totalBudget={ppmp.total_budget}
                                    accountCode={ppmp.account_code}
                                    programName={ppmp.program_name}
                                    deliveryPeriod={ppmp.delivery_period}
                                    placeOfDelivery={ppmp.place_of_delivery}
                                    paymentMethod={ppmp.payment_method}
                                    warrantyAndOtherTerms={ppmp.warranty_and_other_terms}
                                />

                                {/* Official 4-Box Signature Section */}
                                <div className="mt-6">
                                    <SignatureSection ppmp={ppmp} isPrintMode={true} />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 bg-white border-t border-slate-300 flex items-center justify-between text-xs text-slate-700 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">Total Budget:</span>
                                <span className="font-mono text-sm font-extrabold text-blue-900">
                                    {formatCurrency(ppmp.total_budget)}
                                </span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="font-bold text-slate-900">Status:</span>
                                <StatusBadge status={ppmp.status} />
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsItemsModalOpen(false)}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer"
                            >
                                Close Modal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORICAL / PREVIOUS / ANNUAL PPMP FULL CONTENT REVIEW MODAL */}
            {selectedReviewPpmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 backdrop-blur-xs no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] max-h-[94vh] flex flex-col border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base font-bold uppercase tracking-wide text-white">
                                            {!selectedReviewPpmp.parent_id
                                                ? 'Old / Annual PPMP — Full Wide Review'
                                                : (selectedReviewPpmp.amendment_type === 'AMENDMENT' ? 'Previous / Amended PPMP — Full Wide Review' : 'Previous / Supplemental PPMP — Full Wide Review')}
                                        </h2>
                                        <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                                            !selectedReviewPpmp.parent_id
                                                ? 'bg-blue-800 text-blue-200 border-blue-600'
                                                : selectedReviewPpmp.amendment_type === 'AMENDMENT'
                                                ? 'bg-purple-800 text-purple-200 border-purple-600'
                                                : 'bg-emerald-800 text-emerald-200 border-emerald-600'
                                        }`}>
                                            PPMP No. {selectedReviewPpmp.ppmp_number} &bull; {!selectedReviewPpmp.parent_id
                                                ? 'Annual Baseline'
                                                : (selectedReviewPpmp.amendment_type === 'AMENDMENT' ? 'Amended Baseline' : 'Supplemental Baseline')}
                                        </span>
                                        <span className="font-mono text-xs text-slate-300 font-semibold px-2 py-0.5 bg-slate-800 rounded border border-slate-700">
                                            Tracker No.: {selectedReviewPpmp.tracking_number || selectedReviewPpmp.ppmp_number}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-2xl">
                                        {!selectedReviewPpmp.parent_id
                                            ? 'Original baseline plan'
                                            : 'Historical revision baseline'} &bull; Project: {selectedReviewPpmp.title} &bull; CY {selectedReviewPpmp.fiscal_year}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {(!selectedReviewPpmp.parent_id || selectedReviewPpmp.plan_type === 'ANNUAL') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const toApp = selectedReviewPpmp;
                                            setSelectedReviewPpmp(null);
                                            setSelectedAppPpmp(toApp);
                                        }}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                        title="View Old / Annual APP Data"
                                    >
                                        <History className="w-4 h-4" />
                                        Old APP
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const toPrint = selectedReviewPpmp;
                                        setSelectedReviewPpmp(null);
                                        setSelectedPrintPpmp(toPrint);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                                    title="Print this official PPMP document"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print PPMP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedReviewPpmp(null)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Close modal"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Complete Form Layout matching the Active PPMP Official Print / Modal Layout */}
                        <div className="p-4 md:p-8 overflow-y-auto overflow-x-auto flex-1 bg-slate-200">
                            <div className="bg-white rounded-lg border border-slate-400 shadow-lg p-6 md:p-8 max-w-[1500px] mx-auto text-black">
                                {/* Top-left Tracker No. */}
                                <div className="text-xs font-mono font-bold text-slate-800 mb-1">
                                    Tracker No.: <span className="font-bold text-black">{selectedReviewPpmp?.tracking_number || selectedReviewPpmp?.ppmp_number || '—'}</span>
                                </div>

                                {/* Official Header with Seal matching Print View */}
                                <table className="w-full border-collapse mb-2">
                                    <tbody>
                                        <tr>
                                            <td className="w-24 text-center align-middle p-1">
                                                <img
                                                    src="/images/logo.png"
                                                    alt="Province of Davao del Sur Official Seal"
                                                    className="w-20 h-20 mx-auto object-contain"
                                                />
                                            </td>
                                            <td className="text-center align-middle p-1">
                                                <div className="text-xs uppercase font-normal tracking-wide leading-tight">Republic of the Philippines</div>
                                                <div className="text-base font-bold uppercase tracking-wider leading-tight">PROVINCIAL GOVERNMENT OF DAVAO DEL SUR</div>
                                                <div className="text-sm font-normal tracking-tight mt-0.5">
                                                    Matti, Digos City
                                                </div>
                                                <div className="text-sm font-bold tracking-tight mt-0.5">
                                                    PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. <span className="font-mono">{selectedReviewPpmp.ppmp_number}</span>
                                                </div>
                                                <div className="flex items-center justify-center gap-10 text-xs font-bold mt-1">
                                                    <label className="flex items-center gap-1.5 cursor-default">
                                                        <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${selectedReviewPpmp.plan_type === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                                            {selectedReviewPpmp.plan_type === 'INDICATIVE' ? '✓' : ''}
                                                        </span>
                                                        <span>INDICATIVE</span>
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-default">
                                                        <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${selectedReviewPpmp.plan_type === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                                            {selectedReviewPpmp.plan_type === 'FINAL' ? '✓' : ''}
                                                        </span>
                                                        <span>FINAL</span>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="w-24"></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Fiscal Year & End-User Subheaders */}
                                <div className="text-xs mb-3 border-b border-black pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold">
                                            Fiscal Year : <span className="font-normal">(CY {selectedReviewPpmp.fiscal_year})</span>
                                        </div>
                                        <div className="font-bold">
                                            Project Title: <span className="font-semibold text-slate-900">{selectedReviewPpmp.title}</span>
                                        </div>
                                    </div>
                                    <div className="font-bold mt-1">
                                        End-User or Implementing Unit: <span className="font-normal uppercase">({selectedReviewPpmp.implementing_unit || selectedReviewPpmp.office?.name || selectedReviewPpmp.title})</span>
                                    </div>
                                </div>

                                {/* Full Procurement Plan Table with 12 Columns & Delivery Rows */}
                                <ProcurementPlanTable
                                    items={selectedReviewPpmp.items || []}
                                    isEditable={false}
                                    totalBudget={selectedReviewPpmp.total_budget}
                                    accountCode={selectedReviewPpmp.account_code}
                                    programName={selectedReviewPpmp.program_name}
                                    deliveryPeriod={selectedReviewPpmp.delivery_period}
                                    placeOfDelivery={selectedReviewPpmp.place_of_delivery}
                                    paymentMethod={selectedReviewPpmp.payment_method}
                                    warrantyAndOtherTerms={selectedReviewPpmp.warranty_and_other_terms}
                                />

                                {/* Official 4-Box Signature Section */}
                                <div className="mt-6">
                                    <SignatureSection ppmp={selectedReviewPpmp} isPrintMode={true} />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 bg-white border-t border-slate-300 flex items-center justify-between text-xs text-slate-700 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">Baseline Budget:</span>
                                <span className="font-mono text-sm font-extrabold text-blue-900">
                                    {formatCurrency(selectedReviewPpmp.total_budget)}
                                </span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="font-bold text-slate-900">Historical Status:</span>
                                <StatusBadge status={selectedReviewPpmp.status} />
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-500 italic">Read-only historical baseline PPMP</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedReviewPpmp(null)}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer"
                                >
                                    Close Modal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Request Supplemental / Amend Modal */}
            {isAmendModalOpen && (
                <div 
                    className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !submittingAmend) {
                            setIsAmendModalOpen(false);
                        }
                    }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header (Sticky / Shrink-0) */}
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                                    <RefreshCw className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold tracking-wide">
                                        Request Supplemental / Amend PPMP
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                        Submit request letter & justification to reopen workflow
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={submittingAmend}
                                onClick={() => setIsAmendModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body Form with Flex Column and Scrollable Content */}
                        <form onSubmit={handleAmendSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                                {amendError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                                        {amendError}
                                    </div>
                                )}

                                {/* Readonly Info: Tracker Number, PPMP No, Project Title */}
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-semibold">Tracker:</span>
                                            <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {ppmp.tracking_number || ppmp.ppmp_number}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-semibold">PPMP No:</span>
                                            <span className="font-mono font-bold text-slate-800">
                                                {ppmp.ppmp_number}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 font-semibold block text-[11px] mb-0.5">Project Title:</span>
                                        <span className="font-bold text-slate-900 leading-snug block">
                                            {ppmp.title}
                                        </span>
                                    </div>
                                </div>

                                {/* Component to Change Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                        What to Change <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                                                scopePpmpApp
                                                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold shadow-xs'
                                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={scopePpmpApp}
                                                onChange={(e) => setScopePpmpApp(e.target.checked)}
                                                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                                            />
                                            <div>
                                                <div className="text-xs">PPMP / APP</div>
                                                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                                    Procurement items, schedule & budget plan
                                                </div>
                                            </div>
                                        </label>

                                        <label
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                                                scopeAttachmentList
                                                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={scopeAttachmentList}
                                                onChange={(e) => setScopeAttachmentList(e.target.checked)}
                                                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            />
                                            <div>
                                                <div className="text-xs">Update PPMP List of Attachment</div>
                                                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                                    Standard attachment item rows & specifications
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1.5 italic">
                                        Tip: You can select either one or both to update all components of the PPMP.
                                    </div>
                                </div>

                                {/* Option Selection: Supplemental vs Amend (Shown only when PPMP / APP is selected) */}
                                {scopePpmpApp && (
                                    <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                                        <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider">
                                            PPMP / APP Request Type <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                                                    amendType === 'SUPPLEMENTAL'
                                                        ? 'border-amber-500 bg-white text-amber-950 font-bold shadow-2xs'
                                                        : 'border-amber-200/80 bg-white/70 hover:bg-white text-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="request_type"
                                                    value="SUPPLEMENTAL"
                                                    checked={amendType === 'SUPPLEMENTAL'}
                                                    onChange={() => setAmendType('SUPPLEMENTAL')}
                                                    className="text-amber-600 focus:ring-amber-500 h-4 w-4"
                                                />
                                                <div>
                                                    <div className="text-xs">Supplemental</div>
                                                    <div className="text-[10px] text-slate-500 font-normal">Add new procurement items</div>
                                                </div>
                                            </label>

                                            <label
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                                                    amendType === 'AMENDMENT'
                                                        ? 'border-blue-500 bg-white text-blue-950 font-bold shadow-2xs'
                                                        : 'border-amber-200/80 bg-white/70 hover:bg-white text-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="request_type"
                                                    value="AMENDMENT"
                                                    checked={amendType === 'AMENDMENT'}
                                                    onChange={() => setAmendType('AMENDMENT')}
                                                    className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                />
                                                <div>
                                                    <div className="text-xs">Amend</div>
                                                    <div className="text-[10px] text-slate-500 font-normal">Modify approved items/specs</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Reason / Justification */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Reason / Justification <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        required
                                        value={amendReason || ''}
                                        onChange={(e) => setAmendReason(e.target.value)}
                                        placeholder="State the official justification for this supplemental or amendment request..."
                                        className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition resize-none"
                                    />
                                </div>

                                {/* Attach PDF Request Letter */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Attach Letter of Request (PDF) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-4 text-center transition bg-slate-50/50">
                                        <input
                                            type="file"
                                            required
                                            accept="application/pdf,.pdf"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                setAmendFile(file || null);
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center pointer-events-none">
                                            <FileUp className="w-7 h-7 text-amber-600 mb-1" />
                                            {amendFile ? (
                                                <div className="text-xs font-bold text-slate-800">
                                                    Selected: <span className="text-amber-700 underline">{amendFile.name}</span> ({(amendFile.size / 1024).toFixed(1)} KB)
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        Click or drag signed letter of request (PDF)
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                                        Strictly PDF documents up to 20MB
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer (Sticky / Shrink-0) */}
                            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                                <button
                                    type="button"
                                    disabled={submittingAmend}
                                    onClick={() => setIsAmendModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAmend}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    {submittingAmend ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Submit Request
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Admin Disapproval Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <X className="w-5 h-5" />
                                <h3 className="text-sm font-bold">Disapprove Request</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRejectModal(false)}
                                className="p-1 text-rose-200 hover:text-white rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleRejectAmendmentSubmit}>
                            <div className="p-6 space-y-3">
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Please provide specific findings or reason for disapproving this {ppmp.amendment_type === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'} request.
                                </p>
                                <textarea
                                    required
                                    rows={4}
                                    value={rejectRemarks || ''}
                                    onChange={(e) => setRejectRemarks(e.target.value)}
                                    placeholder="Enter disapproval remarks..."
                                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none"
                                />
                            </div>
                            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectingAmend}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                                >
                                    {rejectingAmend ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Disapproving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-4 h-4" />
                                            <span>Confirm Disapproval</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
