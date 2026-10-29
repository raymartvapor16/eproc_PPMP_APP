import React, { useState } from 'react';
import { ppmpService } from '../../services/api';
import { formatDate } from '../UI/StatusBadge';
import { Paperclip, UploadCloud, FileText, Image as ImageIcon, Download, Trash2, Eye, Loader2, History, CheckCircle2, AlertCircle, Bookmark } from 'lucide-react';

export const AttachmentUploader = ({
    ppmp,
    historicalPpmps = [],
    canUpload = false,
    canDelete = false,
    onAttachmentChanged,
    requestLetterAttachmentId = null,
}) => {
    const isRequestLetter = (att) => {
        if (!att) return false;
        if (att.attachment_type === 'REQUEST_LETTER') return true;
        if (requestLetterAttachmentId && (att.id === requestLetterAttachmentId || att.uuid === requestLetterAttachmentId)) return true;
        return false;
    };

    const currentAttachments = (ppmp?.attachments || []).filter(a => !isRequestLetter(a));

    // Collect attachments from earlier / parent / baseline PPMPs (e.g. Supplemental, Amended, Annual)
    const historicalAttachments = React.useMemo(() => {
        const list = [];
        const seenUuids = new Set(currentAttachments.map(a => a.uuid || a.id));

        (historicalPpmps || []).forEach((histPpmp) => {
            const atts = (histPpmp?.attachments || []).filter(a => !isRequestLetter(a));
            atts.forEach((att) => {
                const key = att.uuid || att.id;
                if (!seenUuids.has(key)) {
                    seenUuids.add(key);
                    list.push({
                        ...att,
                        _sourcePpmp: histPpmp,
                    });
                }
            });
        });
        return list;
    }, [currentAttachments, historicalPpmps, requestLetterAttachmentId]);

    const isMarketScopingAttached = React.useMemo(() => {
        const checkAtt = (att) => {
            const isPdf = att?.mime_type === 'application/pdf' || String(att?.original_filename || '').toLowerCase().endsWith('.pdf');
            if (!isPdf) return false;
            return att.attachment_type === 'MARKET_SCOPING' || /market|scoping/i.test(att.original_filename);
        };
        return currentAttachments.some(checkAtt) || historicalAttachments.some(checkAtt);
    }, [currentAttachments, historicalAttachments]);

    const [uploading, setUploading] = useState(false);
    const [updatingTypeUuid, setUpdatingTypeUuid] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [uploadType, setUploadType] = useState(isMarketScopingAttached ? 'SUPPORTING_DOC' : 'MARKET_SCOPING');

    // Automatically suggest MARKET_SCOPING if not yet attached
    React.useEffect(() => {
        if (!isMarketScopingAttached) {
            setUploadType('MARKET_SCOPING');
        }
    }, [isMarketScopingAttached]);

    const totalFilesCount = currentAttachments.length + historicalAttachments.length;

    const isImageFile = (mimeType, filename) => {
        if (mimeType && mimeType.startsWith('image/')) return true;
        if (filename && /\.(jpe?g|png|webp|gif)$/i.test(filename)) return true;
        return false;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        const isPdfOrImage = allowedTypes.includes(file.type) || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);

        if (!isPdfOrImage) {
            setError('Only PDF documents and image files (JPG, PNG, WebP) are allowed.');
            return;
        }

        if (uploadType === 'MARKET_SCOPING' && !file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            setError('Market Scoping document must be a PDF file.');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            setError('File size exceeds the 20MB maximum limit.');
            return;
        }

        setError(null);
        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('attachment_type', uploadType);

        try {
            await ppmpService.uploadAttachment(ppmp.uuid, formData);
            if (onAttachmentChanged) onAttachmentChanged();
            e.target.value = null;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload attachment.');
        } finally {
            setUploading(false);
        }
    };

    const handleToggleType = async (att) => {
        const isCurrentlyScoping = att.attachment_type === 'MARKET_SCOPING' || /market|scoping/i.test(att.original_filename);
        const newType = isCurrentlyScoping ? 'SUPPORTING_DOC' : 'MARKET_SCOPING';
        const fileKey = att.encrypted_uuid || att.uuid;

        setUpdatingTypeUuid(fileKey);
        try {
            await ppmpService.updateAttachmentType(ppmp.uuid, att, newType);
            if (onAttachmentChanged) onAttachmentChanged();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update document classification.');
        } finally {
            setUpdatingTypeUuid(null);
        }
    };

    const handleDelete = async (attachmentUuid) => {
        if (!window.confirm('Are you sure you want to remove this attachment?')) return;

        setDeletingId(attachmentUuid);
        try {
            await ppmpService.deleteAttachment(ppmp.uuid, attachmentUuid);
            if (onAttachmentChanged) onAttachmentChanged();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete attachment.');
        } finally {
            setDeletingId(null);
        }
    };

    const renderBadge = (att) => {
        const isPdf = att?.mime_type === 'application/pdf' || String(att?.original_filename || '').toLowerCase().endsWith('.pdf');
        const isScoping = att.attachment_type === 'MARKET_SCOPING' || (isPdf && /market|scoping/i.test(att.original_filename));

        if (isScoping) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    <Bookmark className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                    Market Scoping PDF
                </span>
            );
        }

        if (att.attachment_type === 'APP_DOCUMENT') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                    APP Document
                </span>
            );
        }

        if (att.attachment_type === 'ATTACHMENT_LIST_DOC') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                    List of Attachment
                </span>
            );
        }

        if (att.attachment_type === 'REQUEST_LETTER') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                    Request Letter
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Supporting Doc
            </span>
        );
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Supporting Documents &amp; Requirements
                    </h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                    {totalFilesCount} file{totalFilesCount !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Mandatory Requirement Status Banner */}
            <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between mb-3 transition-colors ${
                isMarketScopingAttached
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
            }`}>
                <div className="flex items-center gap-2">
                    {isMarketScopingAttached ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                        <span className="font-bold">Market Scoping PDF: </span>
                        <span>
                            {isMarketScopingAttached
                                ? 'Attached and validated for reviewer submission.'
                                : 'Mandatory requirement — must be uploaded as PDF before submitting for review.'}
                        </span>
                    </div>
                </div>
                {!isMarketScopingAttached && canUpload && (
                    <button
                        type="button"
                        onClick={() => setUploadType('MARKET_SCOPING')}
                        className="text-[11px] font-bold text-amber-900 underline hover:text-amber-950 shrink-0 cursor-pointer ml-2"
                    >
                        Upload Market Scoping PDF
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
                    {error}
                </div>
            )}

            {/* List of Attachments */}
            {totalFilesCount === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200 text-slate-500 text-xs">
                    No attachments uploaded yet. Please attach your Market Scoping PDF and other supporting files.
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Current PPMP Files */}
                    {currentAttachments.length > 0 && (
                        <div>
                            {historicalAttachments.length > 0 && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <span>Current PPMP Documents</span>
                                    <span className="text-blue-600">({currentAttachments.length})</span>
                                </div>
                            )}
                            <ul className={`space-y-2 ${currentAttachments.length > 3 ? 'max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar' : ''}`}>
                                {currentAttachments.map((att) => {
                                    const isImg = isImageFile(att.mime_type, att.original_filename);
                                    const isPdf = att?.mime_type === 'application/pdf' || String(att?.original_filename || '').toLowerCase().endsWith('.pdf');
                                    const fileKey = att.encrypted_uuid || att.uuid;
                                    const isDeleting = deletingId === fileKey;
                                    const isUpdatingType = updatingTypeUuid === fileKey;
                                    const isMarketDoc = att.attachment_type === 'MARKET_SCOPING' || (isPdf && /market|scoping/i.test(att.original_filename));

                                    return (
                                        <li
                                            key={att.uuid || att.id}
                                            className={`flex items-center justify-between p-2.5 rounded-md border transition ${
                                                isMarketDoc
                                                    ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
                                                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${
                                                    isMarketDoc ? 'bg-amber-100/60 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'
                                                }`}>
                                                    {isImg ? (
                                                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <FileText className={`w-4 h-4 ${isMarketDoc ? 'text-amber-700' : 'text-rose-600'}`} />
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-semibold text-slate-800 truncate" title={att.original_filename}>
                                                            {att.original_filename}
                                                        </span>
                                                        {renderBadge(att)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        {(att.file_size / 1024).toFixed(1)} KB &bull; {isImg ? 'Image' : 'PDF Document'} &bull; Uploaded {formatDate(att.created_at)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {/* Allow toggling Market Scoping label on PDF */}
                                                {isPdf && canUpload && (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdatingType}
                                                        onClick={() => handleToggleType(att)}
                                                        className={`px-1.5 py-1 text-[10px] font-bold rounded cursor-pointer border transition disabled:opacity-50 ${
                                                            isMarketDoc
                                                                ? 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                                                : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                                        }`}
                                                        title={isMarketDoc ? 'Change to standard supporting document' : 'Designate as Market Scoping PDF'}
                                                    >
                                                        {isUpdatingType ? (
                                                            <Loader2 className="w-3 h-3 animate-spin inline" />
                                                        ) : isMarketDoc ? (
                                                            'Set as Supporting Doc'
                                                        ) : (
                                                            'Mark as Market Scoping'
                                                        )}
                                                    </button>
                                                )}

                                                <a
                                                    href={ppmpService.getAttachmentViewUrl(ppmp.uuid, att)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                                    title="View securely in browser"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>

                                                <a
                                                    href={ppmpService.getAttachmentDownloadUrl(ppmp.uuid, att)}
                                                    download
                                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                                    title="Download file"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>

                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        disabled={isDeleting}
                                                        onClick={() => handleDelete(fileKey)}
                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer disabled:opacity-50"
                                                        title="Delete file"
                                                    >
                                                        {isDeleting ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Historical / Baseline / Supplemental PPMP Attachments */}
                    {historicalAttachments.length > 0 && (
                        <div className={currentAttachments.length > 0 ? "pt-2 border-t border-slate-200" : ""}>
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <History className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>From Previous Revisions &amp; Baseline</span>
                                    <span className="text-indigo-600">({historicalAttachments.length})</span>
                                </div>
                                <span className="text-[9px] text-slate-400 normal-case">Preserved baseline documents</span>
                            </div>
                            <ul className={`space-y-2 ${historicalAttachments.length > 3 ? 'max-h-[195px] overflow-y-auto pr-1.5 custom-scrollbar' : ''}`}>
                                {historicalAttachments.map((att) => {
                                    const isImg = isImageFile(att.mime_type, att.original_filename);
                                    const sourcePpmp = att._sourcePpmp;
                                    const sourceUuid = sourcePpmp?.uuid || ppmp.uuid;
                                    const sourceLabel = !sourcePpmp?.parent_id
                                        ? 'Annual Baseline'
                                        : (sourcePpmp?.amendment_type === 'AMENDMENT' ? 'Amended Baseline' : 'Supplemental Baseline');

                                    return (
                                        <li
                                            key={`hist_${att.uuid || att.id}`}
                                            className="flex items-center justify-between p-2.5 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200/80 rounded-md transition"
                                        >
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <div className="w-8 h-8 rounded bg-white border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                                                    {isImg ? (
                                                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-rose-600" />
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-semibold text-slate-900 truncate" title={att.original_filename}>
                                                            {att.original_filename}
                                                        </span>
                                                        {renderBadge(att)}
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
                                                            PPMP No. {sourcePpmp?.ppmp_number} &bull; {sourceLabel}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {(att.file_size / 1024).toFixed(1)} KB &bull; {isImg ? 'Image' : 'PDF Document'} &bull; Uploaded {formatDate(att.created_at)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <a
                                                    href={ppmpService.getAttachmentViewUrl(sourceUuid, att)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded"
                                                    title="View historical document in new tab"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>

                                                <a
                                                    href={ppmpService.getAttachmentDownloadUrl(sourceUuid, att)}
                                                    download
                                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded"
                                                    title="Download file"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Secure Uploader Form */}
            {canUpload && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span>Document Category:</span>
                            {uploadType === 'MARKET_SCOPING' && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Required for review
                                </span>
                            )}
                        </label>
                        <select
                            value={uploadType}
                            onChange={(e) => setUploadType(e.target.value)}
                            disabled={uploading}
                            className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        >
                            <option value="MARKET_SCOPING">Market Scoping PDF (Mandatory Requirement)</option>
                            <option value="SUPPORTING_DOC">General Supporting Document</option>
                        </select>
                    </div>

                    <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition ${
                        uploadType === 'MARKET_SCOPING'
                            ? 'border-amber-300 hover:border-amber-400 bg-amber-50/40'
                            : 'border-blue-200 hover:border-blue-400 bg-blue-50/50'
                    }`}>
                        <UploadCloud className={`w-6 h-6 mb-1 ${uploadType === 'MARKET_SCOPING' ? 'text-amber-600' : 'text-blue-600'}`} />
                        <span className={`text-xs font-semibold ${uploadType === 'MARKET_SCOPING' ? 'text-amber-900' : 'text-blue-900'}`}>
                            {uploading
                                ? 'Uploading attachment securely...'
                                : uploadType === 'MARKET_SCOPING'
                                    ? 'Click or Drag Market Scoping PDF here'
                                    : 'Click or Drag PDF or Picture (JPG, PNG) here'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                            {uploadType === 'MARKET_SCOPING'
                                ? 'PDF format required • Up to 20MB • Stored in secure private storage'
                                : 'PDF or Images up to 20MB • Stored in private non-public storage'}
                        </span>
                        <input
                            type="file"
                            accept={uploadType === 'MARKET_SCOPING' ? 'application/pdf,.pdf' : 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'}
                            onChange={handleFileChange}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                </div>
            )}
        </div>
    );
};
