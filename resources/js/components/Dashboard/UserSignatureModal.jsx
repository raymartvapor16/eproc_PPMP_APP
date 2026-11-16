import React, { useState } from 'react';
import { PenTool, X, UploadCloud, Check, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { userService } from '../../services/api';
import { SignaturePadModal } from '../UI/SignaturePadModal';

export const UserSignatureModal = ({
    user,
    isOpen,
    onClose,
    onUpdated,
}) => {
    const [isDrawPadOpen, setIsDrawPadOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [newSignatureData, setNewSignatureData] = useState(null);
    const [isEditing, setIsEditing] = useState(!user?.signature_path);
    const [saving, setSaving] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [timestamp, setTimestamp] = useState(Date.now());
    const [feedback, setFeedback] = useState({ type: '', text: '' });

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
            setIsEditing(true);
            setFeedback({ type: '', text: '' });
        };
        reader.readAsDataURL(file);
    };

    const handleDrawSave = (dataUrl) => {
        setPreviewUrl(dataUrl);
        setNewSignatureData(dataUrl);
        setIsEditing(true);
        setIsDrawPadOpen(false);
        setFeedback({ type: '', text: '' });
    };

    const handleSave = async () => {
        if (!newSignatureData) return;
        setSaving(true);
        setFeedback({ type: '', text: '' });
        try {
            const res = await userService.updateSignature(user.id, { signature: newSignatureData });
            const updatedUser = res.data?.user || { ...user, signature_path: 'updated' };
            setFeedback({ type: 'success', text: 'Official signature saved successfully.' });
            setIsEditing(false);
            setNewSignatureData(null);
            setTimestamp(Date.now());
            if (onUpdated) {
                onUpdated(updatedUser);
            }
        } catch (err) {
            console.error('Failed to update signature:', err);
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to save signature. Please try again.'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                                <PenTool className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xs uppercase tracking-wider">
                                    Official Specimen Signature
                                </h3>
                                <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                                    {user.name}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                        {/* Feedback message */}
                        {feedback.text && (
                            <div className={`p-2.5 rounded-lg text-xs font-medium ${
                                feedback.type === 'error'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                                {feedback.text}
                            </div>
                        )}

                        {/* User Details */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-slate-900">{user.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                    {user.designation || 'Specialist / Officer'} &bull; {user.office?.name || 'Provincial Capitol'}
                                </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase font-bold">
                                {user.role?.replace(/_/g, ' ')}
                            </span>
                        </div>

                        {/* Signature Preview Canvas Card */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col items-center justify-center min-h-[150px] relative shadow-inner">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="New Signature Preview"
                                    className="max-h-32 object-contain"
                                />
                            ) : user.signature_path && !imageError ? (
                                <img
                                    src={`/api/users/${user.id}/signature?t=${timestamp}`}
                                    alt={`Signature of ${user.name}`}
                                    className="max-h-32 object-contain"
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <div className="text-center p-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
                                        <PenTool className="w-5 h-5" />
                                    </div>
                                    <div className="text-xs text-slate-500 font-semibold">
                                        No Specimen Signature on File
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                        Upload a transparent PNG image or draw a specimen signature below.
                                    </div>
                                </div>
                            )}

                            {previewUrl && (
                                <span className="absolute bottom-2 left-2 text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                                    Unsaved Draft Specimen
                                </span>
                            )}
                        </div>

                        {/* Controls to Upload or Draw */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition">
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>Upload PNG</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsDrawPadOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition cursor-pointer"
                                >
                                    <PenTool className="w-3.5 h-3.5" />
                                    <span>Draw Pad</span>
                                </button>
                            </div>

                            {previewUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPreviewUrl(null);
                                        setNewSignatureData(null);
                                        setIsEditing(false);
                                    }}
                                    className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                        <div>
                            {user.signature_path && (
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Signature Active
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
                            {newSignatureData && (
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
                                            <span>Save Signature</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Draw Signature Modal */}
            {isDrawPadOpen && (
                <SignaturePadModal
                    isOpen={isDrawPadOpen}
                    onClose={() => setIsDrawPadOpen(false)}
                    onSave={handleDrawSave}
                    initialDataUrl={previewUrl}
                    title={`Specimen Signature for ${user.name}`}
                    description="Draw the official government specimen signature smoothly using a mouse, touch screen, or stylus."
                />
            )}
        </>
    );
};
export default UserSignatureModal;
