import React, { useState, useEffect } from 'react';
import {
    PenTool,
    X,
    UploadCloud,
    Check,
    Loader2,
    ShieldCheck,
    Calendar,
    FileText,
    AlertTriangle,
    Lock,
    RefreshCw,
    Printer,
    History,
    Clock,
    CheckCircle2,
} from 'lucide-react';
import { userService } from '../../services/api';
import { SignaturePadModal } from '../UI/SignaturePadModal';

export const UserSignatureModal = ({
    user,
    isOpen,
    onClose,
    onUpdated,
    currentUserRole = null,
}) => {
    const resolvedCurrentRole = currentUserRole || window.App?.user?.role || '';
    const isCurrentUserSuperAdmin = resolvedCurrentRole === 'super_admin';
    const pnpkiRecord = user?.pnpki_signature || user?.pnpkiSignature || null;

    const [isDrawPadOpen, setIsDrawPadOpen] = useState(false);
    const [studioInitialStep, setStudioInitialStep] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [newSignatureData, setNewSignatureData] = useState(null);
    const [signatureMeta, setSignatureMeta] = useState({
        signatureType: pnpkiRecord?.signature_type || 'optional',
        expirationDate: pnpkiRecord?.expiration_date || '',
        pnpkiProofFile: null,
        existingProofName: pnpkiRecord?.proof_original_name || '',
        existingProofUrl: pnpkiRecord?.proof_pdf_url || '',
        previousExpirationDate: pnpkiRecord?.previous_expiration_date || '',
        previousProofName: pnpkiRecord?.previous_proof_original_name || '',
        previousProofUrl: pnpkiRecord?.previous_proof_pdf_url || '',
        captureMethod: pnpkiRecord?.capture_method || 'drawn',
        isRenewal: false,
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reviewingRenewal, setReviewingRenewal] = useState(false);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [renewalRejectReason, setRenewalRejectReason] = useState('');
    const [imageError, setImageError] = useState(false);
    const [timestamp, setTimestamp] = useState(Date.now());
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    useEffect(() => {
        if (!user) return;
        const pnpki = user?.pnpki_signature || user?.pnpkiSignature || null;
        setSignatureMeta({
            signatureType: pnpki?.signature_type || 'optional',
            expirationDate: pnpki?.expiration_date || '',
            pnpkiProofFile: null,
            existingProofName: pnpki?.proof_original_name || '',
            existingProofUrl: pnpki?.proof_pdf_url || '',
            previousExpirationDate: pnpki?.previous_expiration_date || '',
            previousProofName: pnpki?.previous_proof_original_name || '',
            previousProofUrl: pnpki?.previous_proof_pdf_url || '',
            captureMethod: pnpki?.capture_method || 'drawn',
            isRenewal: false,
        });
        setPreviewUrl(null);
        setNewSignatureData(null);
        setImageError(false);
        setHasChanges(false);
        setFeedback({ type: '', text: '' });
    }, [user]);

    if (!isOpen || !user) return null;

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, WebP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setPreviewUrl(reader.result);
            setNewSignatureData(reader.result);
            setSignatureMeta((prev) => ({ ...prev, captureMethod: 'uploaded' }));
            setHasChanges(true);
            setFeedback({ type: '', text: '' });
        };
        reader.readAsDataURL(file);
    };

    const handleProofPdfChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setFeedback({ type: 'error', text: 'Please select a valid PDF file for Proof of Registration of PNPKI.' });
            e.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setFeedback({ type: 'error', text: 'Proof of Registration PDF must not exceed 5MB.' });
            e.target.value = '';
            return;
        }

        setSignatureMeta((prev) => ({
            ...prev,
            pnpkiProofFile: file,
            existingProofName: file.name,
        }));
        setHasChanges(true);
        setFeedback({ type: '', text: '' });
    };

    const handleStudioSave = (dataUrl, meta = null) => {
        if (dataUrl) {
            setPreviewUrl(dataUrl);
            setNewSignatureData(dataUrl);
        }
        if (meta) {
            setSignatureMeta((prev) => ({
                ...prev,
                signatureType: meta.signatureType || 'optional',
                expirationDate: meta.expirationDate || '',
                pnpkiProofFile: meta.pnpkiProofFile || prev.pnpkiProofFile || null,
                existingProofName: meta.existingProofName || meta.pnpkiProofFile?.name || prev.existingProofName,
                captureMethod: meta.captureMethod || 'drawn',
                isRenewal: Boolean(prev.isRenewal || studioInitialStep === 'pnpki'),
            }));
        }
        setHasChanges(true);
        setIsDrawPadOpen(false);
        setStudioInitialStep(null);
        setFeedback({ type: '', text: '' });
    };

    const handleSave = async () => {
        if (!newSignatureData && !hasChanges) return;

        if (!newSignatureData && !user.signature_path) {
            setFeedback({
                type: 'error',
                text: 'Please draw or upload a signature image first using Signature Studio or Quick PNG.',
            });
            return;
        }

        if (signatureMeta.signatureType === 'pnpki') {
            if (!signatureMeta.expirationDate) {
                setFeedback({
                    type: 'error',
                    text: 'Please select an Expiration Date for the PNPKI Digital E-Signature.',
                });
                return;
            }
            if (!signatureMeta.pnpkiProofFile && !signatureMeta.existingProofUrl && !signatureMeta.existingProofName) {
                setFeedback({
                    type: 'error',
                    text: 'Please attach the Proof of Registration of PNPKI (PDF, Max 5MB).',
                });
                return;
            }
        }

        setSaving(true);
        setFeedback({ type: '', text: '' });
        try {
            let payload;
            if (signatureMeta.pnpkiProofFile) {
                payload = new FormData();
                if (newSignatureData) {
                    payload.append('signature', newSignatureData);
                }
                payload.append('signature_type', signatureMeta.signatureType || 'optional');
                payload.append('signature_capture_method', signatureMeta.captureMethod || 'drawn');
                if (signatureMeta.signatureType === 'pnpki') {
                    payload.append('pnpki_expiration_date', signatureMeta.expirationDate || '');
                    payload.append('pnpki_proof_pdf', signatureMeta.pnpkiProofFile);
                    if (signatureMeta.isRenewal) {
                        payload.append('is_renewal', '1');
                    }
                }
            } else {
                payload = {
                    signature: newSignatureData,
                    signature_type: signatureMeta.signatureType || 'optional',
                    signature_capture_method: signatureMeta.captureMethod || 'drawn',
                    pnpki_expiration_date:
                        signatureMeta.signatureType === 'pnpki' ? signatureMeta.expirationDate : null,
                    is_renewal: Boolean(signatureMeta.isRenewal),
                };
            }

            const res = await userService.updateSignature(user.id, payload);
            const updatedUser = res.data?.user || { ...user, signature_path: 'updated' };
            setFeedback({ type: 'success', text: 'Official signature & PNPKI settings saved successfully.' });
            setHasChanges(false);
            setNewSignatureData(null);
            setTimestamp(Date.now());
            if (onUpdated) {
                onUpdated(updatedUser);
            }
        } catch (err) {
            console.error('Failed to update signature:', err);
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to save signature. Please try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    const isPnpki = signatureMeta.signatureType === 'pnpki';
    const isExpired = Boolean(
        isPnpki &&
        signatureMeta.expirationDate &&
        new Date(`${signatureMeta.expirationDate}T23:59:59`) < new Date()
    );
    const isEffectivePnpki = isPnpki && !isExpired;
    const isLockedForNonSuperAdmin = isPnpki && !isExpired && !isCurrentUserSuperAdmin;
    const isRenewalPending = Boolean(pnpkiRecord?.renewal_status === 'pending' && pnpkiRecord?.pending_expiration_date);

    const handleApproveRenewal = async () => {
        setReviewingRenewal(true);
        setFeedback({ type: '', text: '' });
        try {
            const res = await userService.approvePnpkiRenewal(user.id);
            const updatedUser = res.data?.user || user;
            setFeedback({
                type: 'success',
                text: res.data?.message || 'PNPKI Digital E-Signature renewal approved successfully.',
            });
            setShowRejectInput(false);
            setRenewalRejectReason('');
            setTimestamp(Date.now());
            if (onUpdated) {
                onUpdated(updatedUser);
            }
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to approve PNPKI renewal.',
            });
        } finally {
            setReviewingRenewal(false);
        }
    };

    const handleRejectRenewal = async () => {
        setReviewingRenewal(true);
        setFeedback({ type: '', text: '' });
        try {
            const res = await userService.rejectPnpkiRenewal(user.id, renewalRejectReason);
            const updatedUser = res.data?.user || user;
            setFeedback({
                type: 'success',
                text: res.data?.message || 'PNPKI Digital E-Signature renewal request disapproved.',
            });
            setShowRejectInput(false);
            setRenewalRejectReason('');
            if (onUpdated) {
                onUpdated(updatedUser);
            }
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to disapprove PNPKI renewal.',
            });
        } finally {
            setReviewingRenewal(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                >

                    <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                                {isPnpki ? <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" /> : <PenTool className="w-4.5 h-4.5" />}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-white">
                                        Signature &amp; PNPKI Management
                                    </h3>
                                    {isCurrentUserSuperAdmin && (
                                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-rose-500/20 text-rose-200 border border-rose-400/30">
                                            Super Admin Control
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                    {user.name} &bull; {user.office?.name || 'Provincial Capitol'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">

                        {feedback.text && (
                            <div
                                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                                    feedback.type === 'error'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                            >
                                {feedback.type === 'error' ? (
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                                ) : (
                                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                                )}
                                <span>{feedback.text}</span>
                            </div>
                        )}

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                    {user.designation || 'Specialist / Officer'} &bull;{' '}
                                    {user.office?.name || 'Provincial Capitol'}
                                </div>
                            </div>
                            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase font-bold shrink-0">
                                {user.role?.replace(/_/g, ' ')}
                            </span>
                        </div>

                        {isRenewalPending && (
                            <div className="rounded-xl p-4 border-2 border-amber-400 bg-amber-50/80 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                                                PNPKI Renewal Pending Super Admin Approval
                                            </h4>
                                            <p className="text-[10px] text-amber-800">
                                                Old expiration date and proof PDF will remain preserved upon approval.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300">
                                        Awaiting Approval
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] bg-white/90 p-3 rounded-lg border border-amber-200">
                                    <div>
                                        <span className="text-slate-500 block text-[10px] font-bold uppercase">
                                            Requested New Expiration Date
                                        </span>
                                        <strong className="text-emerald-800 text-xs font-mono">
                                            {pnpkiRecord.pending_expiration_date}
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[10px] font-bold uppercase">
                                            Submitted Proof of Registration
                                        </span>
                                        {pnpkiRecord.pending_proof_pdf_url ? (
                                            <a
                                                href={pnpkiRecord.pending_proof_pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 underline mt-0.5"
                                            >
                                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate max-w-[180px]">
                                                    {pnpkiRecord.pending_proof_original_name || 'View New PNPKI Proof PDF'}
                                                </span>
                                            </a>
                                        ) : (
                                            <span className="text-slate-400 italic">No PDF attached</span>
                                        )}
                                    </div>
                                </div>

                                {pnpkiRecord.pending_signature_image_path && (
                                    <div className="bg-white p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-3">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">
                                            Attached New E-Sig Image:
                                        </span>
                                        <img
                                            src={`/api/users/${encodeURIComponent(user.encrypted_id)}/signature?version=pending&t=${timestamp}`}
                                            alt="Pending New E-Signature"
                                            className="max-h-12 object-contain"
                                        />
                                    </div>
                                )}

                                {isCurrentUserSuperAdmin ? (
                                    <div className="space-y-2 pt-1">
                                        {showRejectInput && (
                                            <div className="space-y-1.5">
                                                <textarea
                                                    rows={2}
                                                    value={renewalRejectReason}
                                                    onChange={(e) => setRenewalRejectReason(e.target.value)}
                                                    placeholder="Optional: Enter reason for disapproving this PNPKI renewal..."
                                                    className="w-full p-2 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                            {showRejectInput ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={reviewingRenewal}
                                                        onClick={() => setShowRejectInput(false)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={reviewingRenewal}
                                                        onClick={handleRejectRenewal}
                                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>{reviewingRenewal ? 'Disapproving...' : 'Confirm Disapprove'}</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={reviewingRenewal}
                                                        onClick={() => setShowRejectInput(true)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 transition cursor-pointer disabled:opacity-50"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>Disapprove</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={reviewingRenewal}
                                                        onClick={handleApproveRenewal}
                                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>{reviewingRenewal ? 'Approving...' : 'Approve Renewal'}</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                        <span>Only the Super Administrator can approve or disapprove this renewal request.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isLockedForNonSuperAdmin && (
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Signature Governance Mode
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMeta((prev) => ({ ...prev, signatureType: 'pnpki' }));
                                            setHasChanges(true);
                                            setFeedback({ type: '', text: '' });
                                        }}
                                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                                            isPnpki
                                                ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                                                : 'border-slate-200 hover:border-emerald-300 bg-white'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                            isPnpki ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                                <span>PNPKI Digital E-Sig</span>
                                            </div>
                                            <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                                                Displays E-Sig &amp; Date/Time on PPMP, Detailed Specs, <strong>and Print / Save PDF</strong>.
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureMeta((prev) => ({ ...prev, signatureType: 'optional', isRenewal: false }));
                                            setHasChanges(true);
                                            setFeedback({ type: '', text: '' });
                                        }}
                                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                                            !isPnpki
                                                ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                                                : 'border-slate-200 hover:border-blue-300 bg-white'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                            !isPnpki ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <PenTool className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-extrabold text-slate-900">
                                                Optional Digital Sig
                                            </div>
                                            <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                                                Displays on PPMP &amp; Detailed Specs on screen, <strong>hidden on Print / Save PDF</strong>.
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div
                            className={`rounded-xl p-3.5 border text-xs space-y-2.5 ${
                                isPnpki
                                    ? isExpired
                                        ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                    : 'bg-blue-50/60 border-blue-200 text-blue-900'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-extrabold flex items-center gap-1.5">
                                    {isPnpki ? (
                                        <>
                                            <ShieldCheck className={`w-4 h-4 shrink-0 ${isExpired ? 'text-rose-600' : 'text-emerald-600'}`} />
                                            <span>PNPKI Digital E-Signature</span>
                                        </>
                                    ) : (
                                        <>
                                            <PenTool className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>Optional Digital Signature</span>
                                        </>
                                    )}
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {isPnpki && (
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                isExpired
                                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            }`}
                                        >
                                            {isExpired ? 'Expired (Forced Optional)' : 'Active Certificate'}
                                        </span>
                                    )}
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                            isEffectivePnpki
                                                ? 'bg-white text-emerald-800 border-emerald-300'
                                                : 'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}
                                    >
                                        <Printer className="w-3 h-3" />
                                        {isEffectivePnpki ? 'Shown on Print & PDF' : 'Hidden on Print & PDF'}
                                    </span>
                                </div>
                            </div>

                            <div className="text-[11px] leading-relaxed bg-white/80 rounded-lg p-2.5 border border-black/5 text-slate-700">
                                {isEffectivePnpki ? (
                                    <span>
                                        <strong>Print &amp; Save PDF Behavior:</strong> E-Signature image and Date/Time stamp are <strong>displayed</strong> on PPMP &amp; Detailed Specifications both on-screen and when printing or saving/exporting as PDF.
                                    </span>
                                ) : (
                                    <span>
                                        <strong>Print &amp; Save PDF Behavior:</strong> Signature image and Date/Time stamp are <strong>displayed on-screen</strong> on PPMP &amp; Detailed Specifications, but <strong>will NOT be displayed on printing or saving/importing as PDF</strong>.
                                    </span>
                                )}
                            </div>

                            {isPnpki && (
                                <div className="pt-2 border-t border-emerald-200/70 space-y-3">
                                    {!isLockedForNonSuperAdmin ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                                                    Expiration Date of E-Sig *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="date"
                                                        value={signatureMeta.expirationDate || ''}
                                                        onChange={(e) => {
                                                            const nextDate = e.target.value;
                                                            setSignatureMeta((prev) => ({
                                                                ...prev,
                                                                expirationDate: nextDate,
                                                                isRenewal: Boolean(
                                                                    pnpkiRecord?.expiration_date &&
                                                                    nextDate &&
                                                                    nextDate !== pnpkiRecord.expiration_date
                                                                ),
                                                            }));
                                                            setHasChanges(true);
                                                            setFeedback({ type: '', text: '' });
                                                        }}
                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                                                    PNPKI Proof PDF (Max 5MB) *
                                                </label>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 transition shadow-2xs">
                                                        <UploadCloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span className="truncate max-w-[140px]">
                                                            {signatureMeta.pnpkiProofFile
                                                                ? signatureMeta.pnpkiProofFile.name
                                                                : signatureMeta.existingProofUrl
                                                                    ? 'Replace Proof PDF'
                                                                    : 'Attach Proof PDF'}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="application/pdf,.pdf"
                                                            onChange={handleProofPdfChange}
                                                            className="hidden"
                                                        />
                                                    </label>

                                                    {signatureMeta.existingProofUrl && (
                                                        <a
                                                            href={signatureMeta.existingProofUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold underline underline-offset-2"
                                                            title="View current PNPKI Proof of Registration PDF"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                            <span>View PDF</span>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                            <div className="flex items-center gap-1 text-slate-700">
                                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>
                                                    Expires:{' '}
                                                    <strong className={isExpired ? 'text-rose-700' : 'text-slate-900'}>
                                                        {signatureMeta.expirationDate || 'Not set'}
                                                    </strong>
                                                </span>
                                            </div>

                                            {signatureMeta.existingProofUrl && (
                                                <a
                                                    href={signatureMeta.existingProofUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-300 underline underline-offset-2"
                                                >
                                                    <FileText className="w-3 h-3 text-emerald-600" />
                                                    <span>View PNPKI Proof PDF</span>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {(signatureMeta.previousExpirationDate || signatureMeta.previousProofUrl) && (
                                        <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                <span>
                                                    Previous Expiration:{' '}
                                                    <strong className="text-slate-800">
                                                        {signatureMeta.previousExpirationDate || 'Archived'}
                                                    </strong>
                                                </span>
                                            </div>
                                            {signatureMeta.previousProofUrl && (
                                                <a
                                                    href={signatureMeta.previousProofUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-slate-900 underline underline-offset-2"
                                                >
                                                    <FileText className="w-3 h-3 text-slate-500" />
                                                    <span>Previous Proof PDF</span>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isExpired && (
                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Expired PNPKI certificate — user is forced to Optional signature until renewed.</span>
                                    </div>
                                    {!isLockedForNonSuperAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStudioInitialStep('pnpki');
                                                setIsDrawPadOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wide transition cursor-pointer shrink-0 shadow-xs"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Renew PNPKI</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col items-center justify-center min-h-[140px] relative shadow-inner">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="New Signature Preview"
                                    className="max-h-32 object-contain"
                                />
                            ) : user.signature_path && !imageError ? (
                                <img
                                    src={`/api/users/${encodeURIComponent(user.encrypted_id)}/signature?t=${timestamp}`}
                                    alt={`Signature of ${user.name}`}
                                    className="max-h-32 object-contain"
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <div className="text-center p-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                                        <PenTool className="w-5 h-5" />
                                    </div>
                                    <div className="text-xs text-slate-500 font-semibold">
                                        No Specimen Signature on File
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                        Open Signature Studio or upload a signature image below.
                                    </div>
                                </div>
                            )}

                            {hasChanges && (
                                <span className="absolute bottom-2 left-2 text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200">
                                    Unsaved Changes Ready
                                </span>
                            )}
                        </div>

                        {isLockedForNonSuperAdmin ? (
                            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600 font-semibold">
                                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                                <span>
                                    Locked: This user currently uses an active PNPKI Digital E-Signature. Only the Super Administrator can edit it.
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStudioInitialStep(null);
                                            setIsDrawPadOpen(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer"
                                    >
                                        <PenTool className="w-3.5 h-3.5" />
                                        <span>Signature Studio (PNPKI / Optional)</span>
                                    </button>
                                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition">
                                        <UploadCloud className="w-3.5 h-3.5" />
                                        <span>Upload Signature Image</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {hasChanges && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const pnpki = user?.pnpki_signature || user?.pnpkiSignature || null;
                                            setSignatureMeta({
                                                signatureType: pnpki?.signature_type || 'optional',
                                                expirationDate: pnpki?.expiration_date || '',
                                                pnpkiProofFile: null,
                                                existingProofName: pnpki?.proof_original_name || '',
                                                existingProofUrl: pnpki?.proof_pdf_url || '',
                                                previousExpirationDate: pnpki?.previous_expiration_date || '',
                                                previousProofName: pnpki?.previous_proof_original_name || '',
                                                previousProofUrl: pnpki?.previous_proof_pdf_url || '',
                                                captureMethod: pnpki?.capture_method || 'drawn',
                                                isRenewal: false,
                                            });
                                            setPreviewUrl(null);
                                            setNewSignatureData(null);
                                            setHasChanges(false);
                                            setFeedback({ type: '', text: '' });
                                        }}
                                        className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                                    >
                                        Reset Changes
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
                        <div>
                            {user.signature_path && (
                                <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    {isEffectivePnpki ? 'PNPKI E-Signature Active' : 'Optional Digital Signature Active'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                Close
                            </button>
                            {hasChanges && !isLockedForNonSuperAdmin && (
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Save Signature Settings</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isDrawPadOpen && (
                <SignaturePadModal
                    isOpen={isDrawPadOpen}
                    onClose={() => {
                        setIsDrawPadOpen(false);
                        setStudioInitialStep(null);
                    }}
                    onSave={handleStudioSave}
                    initialDataUrl={previewUrl}
                    initialMeta={signatureMeta}
                    initialStep={studioInitialStep}
                    title={`Specimen Signature Studio — ${user.name}`}
                    description="Choose PNPKI Digital E-Signature or Optional Digital Signature, then draw or attach the official signature."
                />
            )}
        </>
    );
};
export default UserSignatureModal;
