import React, { useState, useEffect, useRef } from 'react';
import {
    Ticket,
    Sparkles,
    Bug,
    X,
    CheckCircle2,
    AlertCircle,
    Upload,
    Image as ImageIcon,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Copy,
    Check,
    Minimize2,
    Maximize2,
    Clock,
    ShieldCheck,
    Trash2,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';
import { systemRequestService } from '../../services/api';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MODULE_OPTIONS = [
    { value: 'eproc_ppmp_app', label: 'E-Procurement (PPMP / APP)' },
    { value: 'pims', label: 'PIMS (Purchase Request)' },
    { value: 'monitoring', label: 'Project Monitoring' },
    { value: 'supplier_evaluation', label: 'Supplier Evaluation' },
    { value: 'general', label: 'General / Portal' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low', cls: 'border-slate-300 bg-slate-50 text-slate-700' },
    { value: 'medium', label: 'Medium', cls: 'border-blue-300 bg-blue-50 text-blue-700' },
    { value: 'high', label: 'High', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
    { value: 'urgent', label: 'Urgent', cls: 'border-rose-300 bg-rose-50 text-rose-700' },
];

const STATUS_STYLES = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-rose-100 text-rose-800 border-rose-300',
};

const resolveDefaultModule = (currentView) => {
    if (currentView === 'pims') return 'pims';
    if (currentView === 'monitoring') return 'monitoring';
    if (currentView === 'supplierevaluation') return 'supplier_evaluation';
    return 'eproc_ppmp_app';
};

export const SystemRequestFloatingWidget = ({ user, currentView }) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('new'); // 'new' | 'mine'

    // Step 1: Ticket generation -> Step 2: Request form -> Step 3: Submitted
    const [step, setStep] = useState(1);
    const [generatingTicket, setGeneratingTicket] = useState(false);
    const [ticketNumber, setTicketNumber] = useState('');
    const [ticketToken, setTicketToken] = useState('');
    const [copiedTicket, setCopiedTicket] = useState(false);

    // Step 2: Form fields
    const [requestType, setRequestType] = useState('bug_fix');
    const [systemModule, setSystemModule] = useState(() => resolveDefaultModule(currentView));
    const [priority, setPriority] = useState('medium');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [submittedRecord, setSubmittedRecord] = useState(null);

    // My Tickets
    const [myRequests, setMyRequests] = useState([]);
    const [loadingMine, setLoadingMine] = useState(false);

    const fileInputRef = useRef(null);

    useEffect(() => {
        setSystemModule(resolveDefaultModule(currentView));
    }, [currentView]);

    useEffect(() => {
        return () => {
            if (attachmentPreview) {
                URL.revokeObjectURL(attachmentPreview);
            }
        };
    }, [attachmentPreview]);

    const fetchMyRequests = async () => {
        setLoadingMine(true);
        try {
            const res = await systemRequestService.getMine();
            setMyRequests(res.data?.data || []);
        } catch (_) {
            // silent
        } finally {
            setLoadingMine(false);
        }
    };

    useEffect(() => {
        if (isOpen && activeTab === 'mine') {
            fetchMyRequests();
        }
    }, [isOpen, activeTab]);

    if (!user) return null;

    const resetNewRequest = () => {
        setStep(1);
        setTicketNumber('');
        setTicketToken('');
        setCopiedTicket(false);
        setRequestType('bug_fix');
        setSystemModule(resolveDefaultModule(currentView));
        setPriority('medium');
        setSubject('');
        setDescription('');
        if (attachmentPreview) {
            URL.revokeObjectURL(attachmentPreview);
        }
        setAttachmentFile(null);
        setAttachmentPreview('');
        setErrorMsg('');
        setSubmittedRecord(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOpenModal = () => {
        setIsOpen(true);
        setErrorMsg('');
    };

    const handleCloseModal = () => {
        setIsOpen(false);
        setErrorMsg('');
    };

    const handleGenerateTicket = async () => {
        setGeneratingTicket(true);
        setErrorMsg('');
        try {
            const res = await systemRequestService.generateTicket();
            setTicketNumber(res.data?.ticket_number || '');
            setTicketToken(res.data?.ticket_token || '');
            setCopiedTicket(false);
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to generate ticket. Please try again.');
        } finally {
            setGeneratingTicket(false);
        }
    };

    const handleCopyTicket = () => {
        if (!ticketNumber) return;
        navigator.clipboard?.writeText(ticketNumber).then(() => {
            setCopiedTicket(true);
            setTimeout(() => setCopiedTicket(false), 2000);
        }).catch(() => {});
    };

    const handleFileChange = (e) => {
        setErrorMsg('');
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setErrorMsg('Invalid file type. Only JPG, PNG, or WEBP images are allowed.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            setErrorMsg('Image exceeds the 5 MB limit. Please upload a smaller image.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (attachmentPreview) {
            URL.revokeObjectURL(attachmentPreview);
        }
        setAttachmentFile(file);
        setAttachmentPreview(URL.createObjectURL(file));
    };

    const handleRemoveAttachment = () => {
        if (attachmentPreview) {
            URL.revokeObjectURL(attachmentPreview);
        }
        setAttachmentFile(null);
        setAttachmentPreview('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!ticketNumber || !ticketToken) {
            setErrorMsg('Please generate and confirm a ticket first.');
            setStep(1);
            return;
        }

        if (subject.trim().length < 4) {
            setErrorMsg('Please enter a subject (at least 4 characters).');
            return;
        }

        if (description.trim().length < 10) {
            setErrorMsg('Please describe the error or requested enhancement (at least 10 characters).');
            return;
        }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('ticket_number', ticketNumber);
            fd.append('ticket_token', ticketToken);
            fd.append('request_type', requestType);
            fd.append('system_module', systemModule);
            fd.append('priority', priority);
            fd.append('subject', subject.trim());
            fd.append('description', description.trim());
            if (attachmentFile) {
                fd.append('attachment', attachmentFile);
            }

            const res = await systemRequestService.create(fd);
            setSubmittedRecord(res.data?.data || { ticket_number: ticketNumber });
            setStep(3);
            fetchMyRequests();
        } catch (err) {
            const errors = err.response?.data?.errors;
            const firstErr = errors ? Object.values(errors).flat()[0] : null;
            setErrorMsg(firstErr || err.response?.data?.message || 'Failed to submit system request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Responsive Floating Action Button (Bottom-Right) */}
            <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 print:hidden flex items-center gap-1.5">
                {isMinimized ? (
                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        title="Expand System Request button"
                        aria-label="Expand System Request button"
                        className="group flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/90 hover:bg-blue-600 text-white shadow-lg border border-white/15 backdrop-blur-md transition-all duration-200 cursor-pointer"
                    >
                        <Ticket className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="sr-only">Expand System Request</span>
                    </button>
                ) : (
                    <div className="flex items-center bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-full shadow-xl shadow-blue-900/30 border border-white/20 p-0.5 sm:p-1 transition-all duration-200">
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            title="Submit a System Bug Fix or Enhancement Request"
                            aria-label="System Request"
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-full hover:bg-white/10 transition cursor-pointer"
                        >
                            <span className="relative flex items-center justify-center">
                                <Ticket className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-blue-700 animate-pulse" />
                            </span>
                            <span className="hidden sm:inline text-xs font-bold tracking-wide whitespace-nowrap">
                                System Request
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            title="Minimize floating icon"
                            aria-label="Minimize floating icon"
                            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-white/15 text-blue-100 hover:text-white transition cursor-pointer mr-0.5"
                        >
                            <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
                    onClick={handleCloseModal}
                >
                    <div
                        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-5 py-4 text-white flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                                    <Ticket className="w-4.5 h-4.5 text-blue-300" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                                        System Enhancement &amp; Fix Request
                                    </h3>
                                    <p className="text-[11px] text-blue-200/80 truncate">
                                        Report system errors or request new implementations
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab('new')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeTab === 'new'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-200/70'
                                }`}
                            >
                                New Request
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('mine')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === 'mine'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-200/70'
                                }`}
                            >
                                <span>My Tickets</span>
                                {myRequests.length > 0 && (
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                        activeTab === 'mine' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                        {myRequests.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            {errorMsg && (
                                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            {activeTab === 'new' && step === 1 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
                                        <span>Step 1 of 2 — Generate Request Ticket</span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                                            <Ticket className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900">
                                                Generate Your Support / Enhancement Ticket
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                                                Every bug report or new feature request requires a unique server-verified ticket number for Super Admin tracking.
                                            </p>
                                        </div>

                                        {!ticketNumber ? (
                                            <button
                                                type="button"
                                                disabled={generatingTicket}
                                                onClick={handleGenerateTicket}
                                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                                            >
                                                {generatingTicket ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Generating Ticket...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4" />
                                                        <span>Generate Ticket</span>
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="space-y-3 pt-1">
                                                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-mono text-sm sm:text-base font-black tracking-wider">
                                                        {ticketNumber}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyTicket}
                                                        title="Copy ticket number"
                                                        className="p-1 rounded-md hover:bg-emerald-200/70 text-emerald-700 transition cursor-pointer"
                                                    >
                                                        {copiedTicket ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Ticket verified &amp; bound to your account (valid for 30 minutes).</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!ticketNumber || !ticketToken}
                                            onClick={() => {
                                                setErrorMsg('');
                                                setStep(2);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition cursor-pointer"
                                        >
                                            <span>Confirm &amp; Proceed</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'new' && step === 2 && (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
                                            <span>Step 2 of 2 — Request Details</span>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800">
                                            Ticket: {ticketNumber}
                                        </span>
                                    </div>

                                    {/* Request Type */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Request Type <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setRequestType('bug_fix')}
                                                className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                                                    requestType === 'bug_fix'
                                                        ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <Bug className={`w-4 h-4 mt-0.5 shrink-0 ${requestType === 'bug_fix' ? 'text-rose-600' : 'text-slate-400'}`} />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">Bug / Error Fix</div>
                                                    <div className="text-[11px] text-slate-500">Errors, glitches, or broken behavior</div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRequestType('enhancement')}
                                                className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                                                    requestType === 'enhancement'
                                                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                                }`}
                                            >
                                                <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${requestType === 'enhancement' ? 'text-blue-600' : 'text-slate-400'}`} />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">New Implementation</div>
                                                    <div className="text-[11px] text-slate-500">New feature or system enhancement</div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* System Module + Priority */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                System Module <span className="text-rose-500">*</span>
                                            </label>
                                            <select
                                                value={systemModule}
                                                onChange={(e) => setSystemModule(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                {MODULE_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Priority <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="grid grid-cols-4 gap-1">
                                                {PRIORITY_OPTIONS.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setPriority(opt.value)}
                                                        className={`py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                                            priority === opt.value
                                                                ? `${opt.cls} ring-2 ring-offset-1 ring-blue-500`
                                                                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Subject / Summary <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={180}
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder={requestType === 'bug_fix' ? 'e.g., Error when exporting PPMP PDF' : 'e.g., Add Excel export filter by office'}
                                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Detailed Description <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            required
                                            rows={4}
                                            maxLength={3000}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describe the error steps or the enhancement you would like implemented..."
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                                        />
                                        <div className="text-right text-[10px] text-slate-400 mt-0.5">
                                            {description.length} / 3000
                                        </div>
                                    </div>

                                    {/* Image Attachment (Image Only, Max 5MB) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Screenshot / Image Attachment <span className="text-slate-400 font-normal">(Optional · Image only, max 5 MB)</span>
                                        </label>
                                        {!attachmentFile ? (
                                            <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 transition cursor-pointer text-center">
                                                <Upload className="w-5 h-5 text-slate-400" />
                                                <span className="text-xs font-semibold text-slate-700">
                                                    Click to attach a screenshot or image
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    JPG, PNG, or WEBP only · Maximum 5 MB
                                                </span>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        ) : (
                                            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                                                <img
                                                    src={attachmentPreview}
                                                    alt="Attachment preview"
                                                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-slate-800 truncate">
                                                        {attachmentFile.name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {(attachmentFile.size / (1024 * 1024)).toFixed(2)} MB · Verified Image
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveAttachment}
                                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer shrink-0"
                                                    title="Remove image"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            <span>Back</span>
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Submitting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Submit Request</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'new' && step === 3 && (
                                <div className="py-6 text-center space-y-4">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-extrabold text-slate-900">
                                            Request Submitted Successfully!
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                            Your ticket has been forwarded to the Super Administrator for review.
                                        </p>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 font-mono text-sm font-black text-slate-900">
                                        {submittedRecord?.ticket_number || ticketNumber}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetNewRequest();
                                                setActiveTab('mine');
                                            }}
                                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                                        >
                                            View My Tickets
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetNewRequest}
                                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                                        >
                                            Submit Another
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'mine' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Your Submitted Tickets</span>
                                        <button
                                            type="button"
                                            onClick={fetchMyRequests}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${loadingMine ? 'animate-spin' : ''}`} />
                                            <span>Refresh</span>
                                        </button>
                                    </div>

                                    {loadingMine ? (
                                        <div className="py-10 text-center text-slate-400">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                            <p className="text-xs">Loading your tickets...</p>
                                        </div>
                                    ) : myRequests.length === 0 ? (
                                        <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                            <Ticket className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                                            <p className="text-xs font-semibold text-slate-600">No requests submitted yet</p>
                                            <p className="text-[11px] mt-0.5">Generate a ticket in the New Request tab to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {myRequests.map((item) => (
                                                <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-black text-slate-900">
                                                                {item.ticket_number}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                item.request_type === 'bug_fix'
                                                                    ? 'bg-rose-100 text-rose-700'
                                                                    : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                                {item.request_type === 'bug_fix' ? 'Bug / Fix' : 'Enhancement'}
                                                            </span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-700'}`}>
                                                            {String(item.status || 'pending').replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-800">{item.subject}</div>
                                                    <p className="text-[11px] text-slate-600 whitespace-pre-line">{item.description}</p>
                                                    {item.admin_remarks && (
                                                        <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                                                            <span className="font-bold block text-blue-700 mb-0.5">Super Admin Response:</span>
                                                            {item.admin_remarks}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {item.created_at}
                                                        </span>
                                                        {item.has_attachment && item.attachment_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => systemRequestService.openSecureAttachment(item.attachment_url)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                                                            >
                                                                <ImageIcon className="w-3.5 h-3.5" />
                                                                <span>View Image</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
