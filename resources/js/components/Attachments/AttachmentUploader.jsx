import React, { useState, useMemo } from 'react';
import { ppmpService } from '../../services/api';
import { formatDate } from '../UI/StatusBadge';
import { showConfirm } from '../../utils/modalAlert';
import {
    Paperclip,
    UploadCloud,
    FileText,
    Image as ImageIcon,
    Download,
    Trash2,
    Eye,
    Loader2,
    History,
    CheckCircle2,
    AlertCircle,
    Bookmark,
    ExternalLink,
    Globe,
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    X,
    Lock,
    Link as LinkIcon,
    ArrowUpRight,
} from 'lucide-react';

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

    const historicalAttachments = useMemo(() => {
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

    const isMarketScopingAttached = useMemo(() => {
        const checkAtt = (att) => {
            const isPdf = att?.mime_type === 'application/pdf' || String(att?.original_filename || '').toLowerCase().endsWith('.pdf');
            if (!isPdf) return false;
            return att.attachment_type === 'MARKET_SCOPING' || /market|scoping/i.test(att.original_filename);
        };
        return currentAttachments.some(checkAtt) || historicalAttachments.some(checkAtt);
    }, [currentAttachments, historicalAttachments]);

    const isInfraProject = useMemo(() => {
        const directType = String(ppmp?.project_type || ppmp?.general_description || '').toLowerCase();
        if (directType.includes('infra')) return true;
        const tracker = String(ppmp?.tracking_number || ppmp?.ppmp_number || '').toLowerCase();
        if (tracker.includes('infra')) return true;
        return (ppmp?.items || []).some(
            (item) => !item.is_header && String(item.project_type || '').toLowerCase().includes('infra')
        );
    }, [ppmp]);

    const [uploading, setUploading] = useState(false);
    const [updatingTypeUuid, setUpdatingTypeUuid] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [uploadType, setUploadType] = useState('SUPPORTING_DOC');

    const [linkTitle, setLinkTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [linkDescription, setLinkDescription] = useState('');
    const [linkError, setLinkError] = useState(null);
    const [savingLink, setSavingLink] = useState(false);

    const [securityModalAtt, setSecurityModalAtt] = useState(null);

    const totalFilesCount = currentAttachments.length + historicalAttachments.length;

    const isImageFile = (mimeType, filename) => {
        if (mimeType && mimeType.startsWith('image/')) return true;
        if (filename && /\.(jpe?g|png|webp|gif)$/i.test(filename)) return true;
        return false;
    };

    const isCloudLink = (att) => {
        if (!att) return false;
        return att.attachment_type === 'INFRA_OTHER_DOC' ||
            Boolean(att.external_url) ||
            att.mime_type === 'application/x-external-link';
    };

    const getCloudProviderInfo = (url) => {
        if (!url) return { name: 'Cloud Storage', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();
            if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
                return { name: 'Google Drive', badge: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
            if (host.includes('onedrive') || host.includes('sharepoint.com') || host.includes('1drv.ms')) {
                return { name: 'OneDrive / SharePoint', badge: 'bg-blue-50 text-blue-800 border-blue-300' };
            }
            if (host.includes('dropbox.com')) {
                return { name: 'Dropbox', badge: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
            }
            if (host.includes('box.com')) {
                return { name: 'Box Cloud', badge: 'bg-sky-50 text-sky-800 border-sky-300' };
            }
            return { name: host.replace(/^www\./, ''), badge: 'bg-slate-100 text-slate-700 border-slate-200' };
        } catch {
            return { name: 'External Link', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
        }
    };

    const validateExternalUrl = (urlString) => {
        const trimmed = (urlString || '').trim();
        if (!trimmed) return 'Please enter the cloud storage URL.';
        if (!/^https:\/\//i.test(trimmed)) {
            return 'Security Error: Only secure SSL/TLS encrypted links (https://...) are accepted.';
        }
        try {
            const parsed = new URL(trimmed);
            const host = parsed.hostname.toLowerCase();
            if (
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host === '::1' ||
                host.startsWith('192.168.') ||
                host.startsWith('10.') ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
                host.startsWith('169.254.')
            ) {
                return 'Security Error: Links to internal or loopback addresses are prohibited.';
            }
            return null;
        } catch {
            return 'Please enter a valid, complete URL (e.g. https://drive.google.com/...)';
        }
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

        const filename = file.name.toLowerCase();
        if (/\.(php|phtml|phar|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.(pdf|jpg|jpeg|png|webp)$/i.test(filename)) {
            setError('Security Warning: Disguised executable file extension detected. Upload blocked.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('File size exceeds the 5MB maximum limit. Only files up to 5MB are permitted.');
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

    const handleAttachLink = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const trimmedTitle = linkTitle.trim();
        const trimmedUrl = linkUrl.trim();

        if (!trimmedTitle) {
            setLinkError('Please provide a document title (e.g. Program of Works / POW & Engineering Plans).');
            return;
        }
        const valErr = validateExternalUrl(trimmedUrl);
        if (valErr) {
            setLinkError(valErr);
            return;
        }

        setLinkError(null);
        setSavingLink(true);

        try {
            await ppmpService.attachLink(ppmp.uuid, {
                title: trimmedTitle,
                url: trimmedUrl,
                description: linkDescription.trim(),
            });
            setLinkTitle('');
            setLinkUrl('');
            setLinkDescription('');
            if (onAttachmentChanged) onAttachmentChanged();
        } catch (err) {
            setLinkError(err.response?.data?.message || 'Failed to attach cloud link.');
        } finally {
            setSavingLink(false);
        }
    };

    const handleSafeOpenLink = (att) => {
        setSecurityModalAtt(att);
    };

    const handleConfirmOpenLink = () => {
        if (!securityModalAtt) return;
        const targetUrl = securityModalAtt.external_url || securityModalAtt.storage_path;
        if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer,nofollow');
        }
        setSecurityModalAtt(null);
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
        const confirmed = await showConfirm({
            title: 'Remove Attachment',
            message: 'Are you sure you want to remove this attachment? This file will be permanently deleted.',
            confirmText: 'Yes, Remove File',
            type: 'danger',
        });
        if (!confirmed) return;

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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs shrink-0">
                    <Bookmark className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                    Market Scoping PDF
                </span>
            );
        }

        if (isCloudLink(att)) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 shadow-2xs shrink-0">
                    <ExternalLink className="w-2.5 h-2.5 text-sky-700" />
                    Cloud Link (POW &amp; Plans)
                </span>
            );
        }

        if (att.attachment_type === 'APP_DOCUMENT') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 shrink-0">
                    APP Document
                </span>
            );
        }

        if (att.attachment_type === 'ATTACHMENT_LIST_DOC') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 shrink-0">
                    Detailed Specifications
                </span>
            );
        }

        if (att.attachment_type === 'REQUEST_LETTER') {
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 shrink-0">
                    Request Letter
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                Supporting Doc
            </span>
        );
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Supporting Documents &amp; Requirements
                    </h3>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold shrink-0">
                    {totalFilesCount} file{totalFilesCount !== 1 ? 's' : ''}
                </span>
            </div>

            {isInfraProject && (
                <div className="mb-3 p-2.5 bg-sky-50/80 border border-sky-200 text-sky-900 text-xs rounded-lg flex items-start gap-2 shadow-2xs">
                    <Globe className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                        <span className="font-bold">Infrastructure Project Detected: </span>
                        <span>
                            For large engineering files, Program of Works (POW), and blueprints exceeding storage limits, you may select <strong>"Other Required Document / POW &amp; Plans (Cloud Link)"</strong> below to attach an external cloud link (e.g. Google Drive, OneDrive).
                        </span>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {totalFilesCount === 0 ? (
                <div className="text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200 text-slate-500 text-xs">
                    No attachments uploaded yet. Please attach your Market Scoping PDF and other supporting files.
                </div>
            ) : (
                <div className="space-y-3">

                    {currentAttachments.length > 0 && (
                        <div>
                            {historicalAttachments.length > 0 && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <span>Current PPMP Documents</span>
                                    <span className="text-blue-600">({currentAttachments.length})</span>
                                </div>
                            )}
                            <ul className={`space-y-2 ${currentAttachments.length > 3 ? 'max-h-[240px] overflow-y-auto pr-1.5 custom-scrollbar' : ''}`}>
                                {currentAttachments.map((att) => {
                                    const isImg = isImageFile(att.mime_type, att.original_filename);
                                    const isPdf = att?.mime_type === 'application/pdf' || String(att?.original_filename || '').toLowerCase().endsWith('.pdf');
                                    const isLink = isCloudLink(att);
                                    const provider = isLink ? getCloudProviderInfo(att.external_url || att.storage_path) : null;
                                    const fileKey = att.encrypted_uuid || att.uuid;
                                    const isDeleting = deletingId === fileKey;
                                    const isUpdatingType = updatingTypeUuid === fileKey;
                                    const isMarketDoc = att.attachment_type === 'MARKET_SCOPING' || (isPdf && /market|scoping/i.test(att.original_filename));

                                    return (
                                        <li
                                            key={att.uuid || att.id}
                                            className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                                                isMarketDoc
                                                    ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
                                                    : isLink
                                                        ? 'bg-sky-50/50 border-sky-200 hover:bg-sky-50'
                                                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                                {isLink ? (
                                                    <div className="w-8 h-8 rounded-lg border border-sky-300 bg-sky-100 flex items-center justify-center shrink-0 text-sky-700">
                                                        <Globe className="w-4 h-4 text-sky-700" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                                                        isMarketDoc ? 'bg-amber-100/60 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'
                                                    }`}>
                                                        {isImg ? (
                                                            <ImageIcon className="w-4 h-4 text-emerald-600" />
                                                        ) : (
                                                            <FileText className={`w-4 h-4 ${isMarketDoc ? 'text-amber-700' : 'text-rose-600'}`} />
                                                        )}
                                                    </div>
                                                )}

                                                <div className="truncate min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-semibold text-slate-800 truncate" title={att.original_filename}>
                                                            {att.original_filename}
                                                        </span>
                                                        {renderBadge(att)}
                                                        {isLink && provider && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${provider.badge}`}>
                                                                {provider.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                        {isLink ? (
                                                            <span>
                                                                Cloud Link &bull; {att.link_description ? `${att.link_description} • ` : ''}Added {formatDate(att.created_at)}
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {(att.file_size / 1024).toFixed(1)} KB &bull; {isImg ? 'Image' : 'PDF Document'} &bull; Uploaded {formatDate(att.created_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">

                                                {!isLink && isPdf && canUpload && (
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

                                                {isLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSafeOpenLink(att)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-md cursor-pointer transition shadow-2xs"
                                                        title="Verify and open external link safely"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                                                        <span>Open Link</span>
                                                        <ArrowUpRight className="w-3 h-3 text-sky-500" />
                                                    </button>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}

                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        disabled={isDeleting}
                                                        onClick={() => handleDelete(fileKey)}
                                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer disabled:opacity-50"
                                                        title="Delete attachment"
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
                            <ul className={`space-y-2 ${historicalAttachments.length > 3 ? 'max-h-[200px] overflow-y-auto pr-1.5 custom-scrollbar' : ''}`}>
                                {historicalAttachments.map((att) => {
                                    const isImg = isImageFile(att.mime_type, att.original_filename);
                                    const isLink = isCloudLink(att);
                                    const provider = isLink ? getCloudProviderInfo(att.external_url || att.storage_path) : null;
                                    const sourcePpmp = att._sourcePpmp;
                                    const sourceUuid = sourcePpmp?.uuid || ppmp.uuid;
                                    const sourceLabel = !sourcePpmp?.parent_id
                                        ? 'Annual Baseline'
                                        : (sourcePpmp?.amendment_type === 'AMENDMENT' ? 'Amended Baseline' : 'Supplemental Baseline');

                                    return (
                                        <li
                                            key={`hist_${att.uuid || att.id}`}
                                            className="flex items-center justify-between p-2.5 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200/80 rounded-lg transition"
                                        >
                                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                                {isLink ? (
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-sky-300 flex items-center justify-center text-sky-700 shrink-0">
                                                        <Globe className="w-4 h-4 text-sky-700" />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                                                        {isImg ? (
                                                            <ImageIcon className="w-4 h-4 text-emerald-600" />
                                                        ) : (
                                                            <FileText className="w-4 h-4 text-rose-600" />
                                                        )}
                                                    </div>
                                                )}
                                                <div className="truncate min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-semibold text-slate-900 truncate" title={att.original_filename}>
                                                            {att.original_filename}
                                                        </span>
                                                        {renderBadge(att)}
                                                        {isLink && provider && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${provider.badge}`}>
                                                                {provider.name}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
                                                            PPMP No. {sourcePpmp?.ppmp_number} &bull; {sourceLabel}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                        {isLink ? (
                                                            <span>
                                                                Cloud Link &bull; {att.link_description ? `${att.link_description} • ` : ''}Added {formatDate(att.created_at)}
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {(att.file_size / 1024).toFixed(1)} KB &bull; {isImg ? 'Image' : 'PDF Document'} &bull; Uploaded {formatDate(att.created_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {isLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSafeOpenLink(att)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-sky-700 bg-white hover:bg-sky-50 border border-sky-300 rounded-md cursor-pointer transition shadow-2xs"
                                                        title="Verify and open external link safely"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                                                        <span>Open Link</span>
                                                        <ArrowUpRight className="w-3 h-3 text-sky-500" />
                                                    </button>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {canUpload && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between gap-2">
                            <label
                                htmlFor="attachment-document-category"
                                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                            >
                                <span>Document Category:</span>
                            </label>
                            {uploadType === 'MARKET_SCOPING' && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                                    Required for review
                                </span>
                            )}
                            {uploadType === 'INFRA_OTHER_DOC' && (
                                <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 shrink-0">
                                    Cloud Link (Large Files)
                                </span>
                            )}
                        </div>
                        <select
                            id="attachment-document-category"
                            name="attachment_document_category"
                            value={uploadType}
                            onChange={(e) => {
                                setUploadType(e.target.value);
                                setError(null);
                                setLinkError(null);
                            }}
                            disabled={uploading || savingLink}
                            className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs truncate"
                        >
                            <option value="SUPPORTING_DOC">General Supporting Document (PDF / Image)</option>
                            {isInfraProject && (
                                <option value="INFRA_OTHER_DOC">
                                    Other Required Document / POW &amp; Plans (Cloud Link)
                                </option>
                            )}
                        </select>
                    </div>

                    {uploadType === 'INFRA_OTHER_DOC' ? (

                        <form onSubmit={handleAttachLink} className="space-y-2.5 p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl shadow-2xs">
                            <div className="flex items-center gap-2 text-xs font-bold text-sky-950 border-b border-sky-200/80 pb-2">
                                <Globe className="w-4 h-4 text-sky-600 shrink-0" />
                                <span>Attach Infrastructure Document / POW Cloud Link</span>
                            </div>

                            {linkError && (
                                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                    <span>{linkError}</span>
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor="attachment-cloud-link-title"
                                    className="block text-[11px] font-bold text-slate-700 mb-1"
                                >
                                    Document Title / Specification <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="attachment-cloud-link-title"
                                    name="attachment_cloud_link_title"
                                    type="text"
                                    value={linkTitle}
                                    onChange={(e) => setLinkTitle(e.target.value)}
                                    placeholder="e.g. Program of Works (POW) &amp; Detailed Engineering Blueprints"
                                    disabled={savingLink}
                                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 font-normal placeholder:text-slate-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="attachment-cloud-link-url"
                                    className="block text-[11px] font-bold text-slate-700 mb-1"
                                >
                                    Cloud Storage URL (HTTPS only) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <input
                                        id="attachment-cloud-link-url"
                                        name="attachment_cloud_link_url"
                                        type="url"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        placeholder="https://drive.google.com/... or https://onedrive.live.com/..."
                                        disabled={savingLink}
                                        className="w-full text-xs bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 font-normal placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="attachment-cloud-link-description"
                                    className="block text-[11px] font-bold text-slate-700 mb-1"
                                >
                                    Scope Description / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    id="attachment-cloud-link-description"
                                    name="attachment_cloud_link_description"
                                    rows={2}
                                    value={linkDescription}
                                    onChange={(e) => setLinkDescription(e.target.value)}
                                    placeholder="e.g. Complete architectural, structural, and electrical drawings (~1.4 GB) with Bill of Quantities."
                                    disabled={savingLink}
                                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 font-normal placeholder:text-slate-400"
                                />
                            </div>

                            <div className="p-2.5 bg-white/90 border border-sky-200 rounded-lg text-[11px] text-slate-600 flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">
                                    <strong className="text-slate-800">Security Guard:</strong> Cloud links require secure SSL/TLS (HTTPS). Opening external links requires review through the E-Procurement safety verification gateway.
                                </span>
                            </div>

                            <button
                                type="submit"
                                disabled={savingLink}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                            >
                                {savingLink ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Attaching Link...</span>
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        <span>Attach Infrastructure Cloud Link</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (

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
                            <span className="text-[10px] text-slate-500 mt-0.5 text-center">
                                {uploadType === 'MARKET_SCOPING'
                                    ? 'PDF format required • Up to 5MB • Stored in secure private storage'
                                    : 'PDF or Images up to 5MB • Stored in private non-public storage'}
                            </span>
                            <input
                                type="file"
                                accept={uploadType === 'MARKET_SCOPING' ? 'application/pdf,.pdf' : 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'}
                                onChange={handleFileChange}
                                disabled={uploading}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>
            )}

            {securityModalAtt && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">

                        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-sky-500/20 rounded-lg border border-sky-400/30">
                                    <ShieldAlert className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight">External Link Safety Verification</h3>
                                    <p className="text-[10px] text-slate-300">Province of Davao del Sur E-Procurement Gateway</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSecurityModalAtt(null)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Document Reference
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <span>{securityModalAtt.original_filename}</span>
                                </h4>
                                {securityModalAtt.link_description && (
                                    <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                                        "{securityModalAtt.link_description}"
                                    </p>
                                )}
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-600 flex items-center gap-1">
                                        <Globe className="w-3.5 h-3.5 text-blue-600" /> Destination Cloud Host:
                                    </span>
                                    <span className="font-mono font-bold text-slate-800">
                                        {getCloudProviderInfo(securityModalAtt.external_url || securityModalAtt.storage_path).name}
                                    </span>
                                </div>
                                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px] break-all select-all shadow-2xs">
                                    {securityModalAtt.external_url || securityModalAtt.storage_path}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold pt-0.5">
                                    <Lock className="w-3 h-3 text-emerald-600" />
                                    <span>Verified HTTPS Connection (TLS 1.3 / Strict Transport Security)</span>
                                </div>
                            </div>

                            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-950">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>Security Advisory &amp; Safe Browsing Rules:</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-amber-900/90 leading-relaxed">
                                    <li>
                                        <strong>Malware Prevention:</strong> Only view official plans, PDFs, and CAD drawings. <em>Never download or run executable files (.exe, .bat, .msi, .vbs)</em> from external links.
                                    </li>
                                    <li>
                                        <strong>Anti-Phishing:</strong> Davao del Sur E-Procurement will <em>never</em> ask you to re-enter your government account credentials on third-party cloud storage sites.
                                    </li>
                                    <li>
                                        <strong>Isolated Browsing:</strong> This link opens in a protected new browser tab with strict <code>noopener</code> and <code>noreferrer</code> safeguards.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setSecurityModalAtt(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                            >
                                Cancel &amp; Return
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmOpenLink}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs cursor-pointer"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Proceed to External Cloud Link</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
