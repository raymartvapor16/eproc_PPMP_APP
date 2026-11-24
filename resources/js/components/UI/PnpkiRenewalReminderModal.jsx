import React, { useState, useEffect, useRef } from 'react';
import {
    ShieldCheck,
    AlertTriangle,
    Clock,
    Calendar,
    FileText,
    UploadCloud,
    RefreshCw,
    Check,
    X,
    PenTool,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    History,
} from 'lucide-react';
import { authService } from '../../services/api';
import { useSignatureSettings } from '../../utils/signatureController';

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export const getPnpkiStatusInfo = (user) => {
    const pnpki = user?.pnpki_signature || user?.pnpkiSignature || null;
    if (!pnpki || !pnpki.expiration_date) {
        return {
            hasPnpkiData: false,
            isExpired: false,
            isExpiringSoon: false,
            daysUntilExpiration: null,
            effectiveType: 'optional',
            isForcedOptional: false,
            pnpki,
        };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [y, m, d] = String(pnpki.expiration_date).slice(0, 10).split('-').map(Number);
    const expDateStart = new Date(y, (m || 1) - 1, d || 1);
    const expDateEnd = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);

    const diffMs = expDateStart.getTime() - todayStart.getTime();
    const daysUntilExpiration = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const isExpired = Boolean(pnpki.is_expired) || now > expDateEnd || daysUntilExpiration < 0;
    const isExpiringSoon = !isExpired && daysUntilExpiration >= 0 && daysUntilExpiration <= 14;
    const isForcedOptional = isExpired;
    const effectiveType = pnpki.signature_type === 'pnpki' && !isExpired ? 'pnpki' : 'optional';
    const isRenewalPending = Boolean(pnpki.is_renewal_pending || pnpki.renewal_status === 'pending');

    return {
        hasPnpkiData: true,
        isExpired,
        isExpiringSoon,
        daysUntilExpiration,
        effectiveType,
        isForcedOptional,
        isRenewalPending,
        renewalStatus: pnpki.renewal_status || 'none',
        pendingExpirationDate: pnpki.pending_expiration_date || null,
        pendingProofPdfUrl: pnpki.pending_proof_pdf_url || null,
        renewalRejectionReason: pnpki.renewal_rejection_reason || null,
        pnpki,
    };
};

export const PnpkiRenewalReminderModal = ({ user, onUserUpdate }) => {
    const { isPnpkiEnabled } = useSignatureSettings();
    const [isOpen, setIsOpen] = useState(false);

    const [modalMode, setModalMode] = useState('reminder');
    const [dismissedForUserId, setDismissedForUserId] = useState(null);
    const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);

    const [newExpirationDate, setNewExpirationDate] = useState('');
    const [newProofFile, setNewProofFile] = useState(null);
    const [newSignatureDataUrl, setNewSignatureDataUrl] = useState(null);
    const [newSignatureName, setNewSignatureName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [forcingOptional, setForcingOptional] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const pdfInputRef = useRef(null);
    const sigImgInputRef = useRef(null);

    const statusInfo = getPnpkiStatusInfo(user);
    const {
        hasPnpkiData,
        isExpired,
        isExpiringSoon,
        daysUntilExpiration,
        isRenewalPending,
        renewalStatus,
        pendingExpirationDate,
        pendingProofPdfUrl,
        renewalRejectionReason,
        pnpki,
    } = statusInfo;

    const getReminderStorageKey = () => {
        if (!user?.id || !pnpki?.expiration_date) return null;
        return `pnpki_reminder_pref_${user.id}_${String(pnpki.expiration_date).slice(0, 10)}`;
    };

    const readReminderPref = () => {
        const key = getReminderStorageKey();
        if (!key) return { remindCount: 0, snoozedUntilOneDayBefore: false, dontShowAgain: false };
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : { remindCount: 0, snoozedUntilOneDayBefore: false, dontShowAgain: false };
        } catch {
            return { remindCount: 0, snoozedUntilOneDayBefore: false, dontShowAgain: false };
        }
    };

    const writeReminderPref = (pref) => {
        const key = getReminderStorageKey();
        if (!key) return;
        try {
            localStorage.setItem(key, JSON.stringify(pref));
        } catch {

        }
    };

    const reminderPref = readReminderPref();
    const isSecondReminderWindow = !isExpired && daysUntilExpiration !== null && daysUntilExpiration <= 1 && (reminderPref.remindCount || 0) >= 1;

    useEffect(() => {
        if (!isPnpkiEnabled || !user?.id) {
            setIsOpen(false);
            if (!user?.id) setDismissedForUserId(null);
            return;
        }

        if (dismissedForUserId === user.id) {
            return;
        }

        if (hasPnpkiData && !isRenewalPending && (isExpired || (pnpki?.signature_type === 'pnpki' && isExpiringSoon))) {
            if (!isExpired) {
                const pref = readReminderPref();
                if (pref.dontShowAgain) {
                    return;
                }
                if (pref.snoozedUntilOneDayBefore && daysUntilExpiration !== null && daysUntilExpiration > 1) {
                    return;
                }
            }
            setDontShowAgainChecked(false);
            setModalMode('reminder');
            setErrorMsg('');
            setSuccessMsg('');
            setIsOpen(true);
        }
    }, [isPnpkiEnabled, user?.id, hasPnpkiData, isRenewalPending, isExpired, isExpiringSoon, daysUntilExpiration, pnpki?.signature_type, pnpki?.expiration_date, dismissedForUserId]);

    useEffect(() => {
        const handleOpenRenewal = (e) => {
            if (!isPnpkiEnabled) {
                setIsOpen(false);
                return;
            }
            const requestedMode = e.detail?.mode || 'renew';
            setModalMode(requestedMode);
            setNewExpirationDate('');
            setNewProofFile(null);
            setNewSignatureDataUrl(null);
            setNewSignatureName('');
            setErrorMsg('');
            setSuccessMsg('');
            setIsOpen(true);
        };

        window.addEventListener('pnpki:open_renewal_modal', handleOpenRenewal);
        return () => window.removeEventListener('pnpki:open_renewal_modal', handleOpenRenewal);
    }, [isPnpkiEnabled]);

    if (!isPnpkiEnabled || !user || !isOpen) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const handlePdfSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            setErrorMsg('Only official PDF files (.pdf) are accepted for the PNPKI Proof of Registration.');
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_PDF_BYTES) {
            setErrorMsg(
                `PNPKI Proof PDF exceeds the 5MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please attach a PDF up to 5MB.`
            );
            if (pdfInputRef.current) pdfInputRef.current.value = '';
            return;
        }

        setErrorMsg('');
        setNewProofFile(file);
    };

    const handleOptionalNewSignatureImg = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setErrorMsg('Please select a valid image file (PNG, JPG, or WebP).');
            if (sigImgInputRef.current) sigImgInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_PDF_BYTES) {
            setErrorMsg('Signature image exceeds the 5MB maximum file size.');
            if (sigImgInputRef.current) sigImgInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setNewSignatureDataUrl(reader.result);
            setNewSignatureName(file.name);
            setErrorMsg('');
        };
        reader.readAsDataURL(file);
    };

    const handleForceOptionalUntilRenewed = async () => {
        setForcingOptional(true);
        setErrorMsg('');
        try {
            const res = await authService.useOptionalSignature();
            if (res.data?.user && onUserUpdate) {
                onUserUpdate(res.data.user);
            }
            setDismissedForUserId(user.id);
            setIsOpen(false);
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to switch to Optional Digital Signature.');
        } finally {
            setForcingOptional(false);
        }
    };

    const handleRemindLater = () => {
        const currentPref = readReminderPref();
        const nextCount = (currentPref.remindCount || 0) + 1;
        writeReminderPref({
            remindCount: nextCount,
            snoozedUntilOneDayBefore: true,
            dontShowAgain: Boolean(isSecondReminderWindow && dontShowAgainChecked),
        });
        setDismissedForUserId(user.id);
        setIsOpen(false);
    };

    const handleRenewalSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!newExpirationDate) {
            setErrorMsg('Please select the new expiration date for your renewed PNPKI Digital E-Signature.');
            return;
        }

        if (!newProofFile) {
            setErrorMsg('Please attach the new PDF Proof of Registration of PNPKI (maximum 5MB).');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('pnpki_expiration_date', newExpirationDate);
            formData.append('pnpki_proof_pdf', newProofFile);
            if (newSignatureDataUrl) {
                formData.append('signature', newSignatureDataUrl);
                formData.append('signature_capture_method', 'uploaded');
            }

            const res = await authService.renewPnpkiSignature(formData);
            if (res.data?.user && onUserUpdate) {
                onUserUpdate(res.data.user);
            }
            window.dispatchEvent(new CustomEvent('notifications:reload'));
            setSuccessMsg(
                res.data?.message ||
                    'Your PNPKI Digital E-Signature renewal request has been submitted and is awaiting approval from the Super Administrator.'
            );
            setDismissedForUserId(user.id);
            setTimeout(() => {
                setIsOpen(false);
                setSuccessMsg('');
            }, 1800);
        } catch (err) {
            const validationErrors = err.response?.data?.errors;
            if (validationErrors) {
                const firstKey = Object.keys(validationErrors)[0];
                setErrorMsg(validationErrors[firstKey][0]);
            } else {
                setErrorMsg(err.response?.data?.message || 'Failed to renew PNPKI Digital E-Signature.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => {
                if (!isExpired) handleRemindLater();
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >

                <div
                    className={`px-5 py-4 text-white flex items-center justify-between gap-3 shrink-0 ${
                        modalMode === 'renew'
                            ? 'bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900'
                            : isExpired
                            ? 'bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900'
                            : 'bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900'
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                modalMode === 'renew'
                                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                    : isExpired
                                    ? 'bg-rose-500/25 border-rose-400/40 text-rose-200'
                                    : 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                            }`}
                        >
                            {modalMode === 'renew' ? (
                                <RefreshCw className="w-5 h-5" />
                            ) : isExpired ? (
                                <AlertTriangle className="w-5 h-5 animate-bounce" />
                            ) : (
                                <Clock className="w-5 h-5 animate-pulse" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                                    {modalMode === 'renew'
                                        ? 'Renew PNPKI Digital E-Signature'
                                        : isExpired
                                        ? 'PNPKI Digital E-Signature Expired'
                                        : 'PNPKI E-Signature Expiration Reminder'}
                                </h3>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                        modalMode === 'renew'
                                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                                            : isExpired
                                            ? 'bg-rose-500/30 text-rose-100 border-rose-300/40'
                                            : 'bg-amber-400/25 text-amber-100 border-amber-300/40'
                                    }`}
                                >
                                    {modalMode === 'renew'
                                        ? 'Certificate Renewal'
                                        : isExpired
                                        ? 'Expired'
                                        : daysUntilExpiration === 0
                                        ? 'Expires Today'
                                        : `${daysUntilExpiration} Day${daysUntilExpiration === 1 ? '' : 's'} Left`}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-200 mt-0.5">
                                {modalMode === 'renew'
                                    ? 'Your old expiration date and proof of registration will remain preserved on file.'
                                    : isExpired
                                    ? 'Action Required: Renew PNPKI or continue with Optional Digital Signature'
                                    : 'Your PNPKI digital certificate is approaching its expiration date'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={isExpired && modalMode === 'reminder' ? handleForceOptionalUntilRenewed : handleRemindLater}
                        className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {modalMode === 'reminder' ? (
                    <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                        {errorMsg && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div
                            className={`p-4 rounded-xl border-2 space-y-2.5 ${
                                isExpired
                                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                            }`}
                        >
                            <div className="flex items-start gap-2.5">
                                {isExpired ? (
                                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                ) : (
                                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1 text-xs leading-relaxed">
                                    {isExpired ? (
                                        <>
                                            <p className="font-bold text-rose-900">
                                                Your PNPKI Digital E-Signature expired on{' '}
                                                <span className="underline">{pnpki?.expiration_date}</span>.
                                            </p>
                                            <p className="text-rose-800">
                                                Because your PNPKI certificate has expired and is not yet renewed, your account is{' '}
                                                <strong>automatically forced to use the Optional Digital Signature</strong>.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-bold text-amber-900">
                                                {daysUntilExpiration === 0 ? (
                                                    <>
                                                        Your PNPKI Digital E-Signature{' '}
                                                        <span className="underline">expires today ({pnpki?.expiration_date})</span>!
                                                    </>
                                                ) : (
                                                    <>
                                                        Your PNPKI Digital E-Signature will expire in{' '}
                                                        <span className="underline">
                                                            {daysUntilExpiration} day{daysUntilExpiration === 1 ? '' : 's'}
                                                        </span>{' '}
                                                        (on <strong>{pnpki?.expiration_date}</strong>).
                                                    </>
                                                )}
                                            </p>
                                            <p className="text-amber-800">
                                                Please renew your PNPKI certificate before it expires. If it expires without renewal, your account will be forced to use the Optional Digital Signature.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isRenewalPending && (
                            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs text-amber-950">
                                <div className="font-extrabold flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Renewal Pending Super Admin Approval</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                                        Awaiting Approval
                                    </span>
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    Your renewal request (New Expiration: <strong>{pendingExpirationDate}</strong>) has been submitted and is waiting for Super Administrator approval.
                                </p>
                                {pendingProofPdfUrl && (
                                    <a
                                        href={pendingProofPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 underline"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>View Submitted Renewal Proof PDF</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {renewalStatus === 'rejected' && renewalRejectionReason && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                                <div className="font-extrabold flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>Previous Renewal Request Disapproved</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">{renewalRejectionReason}</p>
                            </div>
                        )}

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Retained PNPKI Registration Data on File</span>
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                    Preserved
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 pt-1 border-t border-slate-200/80">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                    <span>
                                        Recorded Expiration Date:{' '}
                                        <strong className="text-slate-900">{pnpki?.expiration_date || '—'}</strong>
                                    </span>
                                </div>

                                {pnpki?.proof_pdf_url && (
                                    <a
                                        href={pnpki.proof_pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-300 text-[11px] font-bold text-emerald-800 underline underline-offset-2 transition"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>View Proof of Registration PDF</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        {isSecondReminderWindow && (
                            <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 cursor-pointer select-none hover:bg-slate-100 transition">
                                <input
                                    type="checkbox"
                                    checked={dontShowAgainChecked}
                                    onChange={(e) => setDontShowAgainChecked(e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                                />
                                <span className="font-medium">Don&apos;t show this reminder again</span>
                            </label>
                        )}

                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                            {isExpired ? (
                                <button
                                    type="button"
                                    disabled={forcingOptional}
                                    onClick={handleForceOptionalUntilRenewed}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                                    <span>
                                        {forcingOptional
                                            ? 'Switching...'
                                            : 'Use Optional Digital Signature (Not Yet Renewed)'}
                                    </span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleRemindLater}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                >
                                    Remind Me Later
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setErrorMsg('');
                                    setModalMode('renew');
                                }}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Renew PNPKI Signature Now</span>
                            </button>
                        </div>
                    </div>
                ) : (

                    <form onSubmit={handleRenewalSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
                        {errorMsg && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{successMsg}</span>
                            </div>
                        )}

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Previous PNPKI Data (Will Remain Stored)</span>
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                    Retained in Database
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/80">
                                <span>
                                    Old Expiration Date:{' '}
                                    <strong className="text-slate-900">{pnpki?.expiration_date || 'None'}</strong>
                                </span>
                                {pnpki?.proof_pdf_url && (
                                    <a
                                        href={pnpki.proof_pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>
                                            {pnpki.proof_original_name || 'View Previous Proof PDF'}
                                        </span>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                                New Expiration Date of Using E-Sig <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="date"
                                    min={isExpired ? todayStr : tomorrowStr}
                                    value={newExpirationDate}
                                    onChange={(e) => {
                                        setNewExpirationDate(e.target.value);
                                        setErrorMsg('');
                                    }}
                                    required
                                    className="w-full h-10 pl-9 pr-3 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Select the new validity / expiration date from your renewed DICT PNPKI certificate.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                                New Proof of Registration of PNPKI (PDF, Max 5MB) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                ref={pdfInputRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handlePdfSelect}
                                className="hidden"
                            />
                            {newProofFile ? (
                                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-emerald-950 truncate">
                                                {newProofFile.name}
                                            </div>
                                            <div className="text-[10px] text-emerald-700">
                                                {(newProofFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for renewal
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => pdfInputRef.current?.click()}
                                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg shrink-0 cursor-pointer"
                                    >
                                        Change PDF
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => pdfInputRef.current?.click()}
                                    className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 transition cursor-pointer"
                                >
                                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                                    <span>Attach Renewed PNPKI Proof PDF (Max 5MB)</span>
                                </button>
                            )}
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700">
                                    Specimen E-Signature Image
                                </span>
                                <input
                                    ref={sigImgInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleOptionalNewSignatureImg}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => sigImgInputRef.current?.click()}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                >
                                    {newSignatureDataUrl ? 'Replace Attached Image' : 'Optional: Attach New E-Sig Image'}
                                </button>
                            </div>
                            {newSignatureDataUrl ? (
                                <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                                    <img
                                        src={newSignatureDataUrl}
                                        alt="New E-Signature"
                                        className="h-10 object-contain"
                                    />
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                            {newSignatureName}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewSignatureDataUrl(null);
                                                setNewSignatureName('');
                                            }}
                                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                        >
                                            Keep Existing Instead
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500">
                                    Your existing specimen signature image on file will be kept automatically unless you attach a new one.
                                </p>
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2.5">
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                    if (isExpired || isExpiringSoon) {
                                        setModalMode('reminder');
                                    } else {
                                        setIsOpen(false);
                                    }
                                }}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>

                            <div className="flex items-center gap-2">
                                {isExpired && (
                                    <button
                                        type="button"
                                        disabled={submitting || forcingOptional}
                                        onClick={handleForceOptionalUntilRenewed}
                                        className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer"
                                    >
                                        Use Optional E-Sig Instead
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting || !newExpirationDate || !newProofFile}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Submit Renewal for Approval</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PnpkiRenewalReminderModal;
