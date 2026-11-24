import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Sparkles, AlertCircle, FileSpreadsheet, Shield } from 'lucide-react';
import { userService } from '../../services/api';
import { AccountCodeMultiSelect } from '../UI/AccountCodeMultiSelect';

export const UserAccountCodesModal = ({
    isOpen,
    onClose,
    targetUser,
    onSuccess,
}) => {
    const parseIds = (user) => {
        const codes = user?.account_codes || user?.accountCodes || [];
        return codes
            .map(ac => (typeof ac === 'object' && ac !== null ? Number(ac.id) : Number(ac)))
            .filter(id => !isNaN(id) && id > 0);
    };

    const [selectedIds, setSelectedIds] = useState(() => parseIds(targetUser));
    const [fetching, setFetching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !targetUser?.id) return;
        setSelectedIds(parseIds(targetUser));
        setError('');

        let isMounted = true;
        setFetching(true);
        userService.getAccountCodes(targetUser.id)
            .then(res => {
                if (!isMounted) return;
                const codes = res.data?.account_codes || [];
                const ids = codes
                    .map(ac => (typeof ac === 'object' && ac !== null ? Number(ac.id) : Number(ac)))
                    .filter(id => !isNaN(id) && id > 0);
                setSelectedIds(ids);
            })
            .catch(err => {
                console.warn('Could not fetch latest user account codes:', err);
            })
            .finally(() => {
                if (isMounted) setFetching(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, targetUser?.id]);

    if (!isOpen || !targetUser) return null;

    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            const res = await userService.updateAccountCodes(targetUser.id, selectedIds);
            const updatedUser = res.data?.user || { ...targetUser, account_codes: selectedIds };
            if (onSuccess) {
                onSuccess(updatedUser);
            }
            onClose();
        } catch (err) {
            console.error('Failed to update TWG account codes:', err);
            const msg = err.response?.data?.message || 'Failed to update assigned account codes. Please try again.';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                            <FileSpreadsheet className="w-5 h-5 text-amber-200" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Assign Account Codes to BAC-TWG Reviewer</h3>
                            <p className="text-[11px] text-amber-100 flex items-center gap-1.5 mt-0.5">
                                <span className="font-semibold">{targetUser.name}</span>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-amber-200">{targetUser.email}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-xs text-amber-900 shrink-0">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                            TWG Reviewers only evaluate PPMP line items corresponding to their assigned account codes.
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {fetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />}
                        <span className="font-bold text-[11px] bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full">
                            {selectedIds.length} Selected
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 shrink-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="p-6 overflow-y-auto flex-1">
                    <AccountCodeMultiSelect
                        selectedIds={selectedIds}
                        onChange={setSelectedIds}
                        label="Assigned Chart of Account Codes"
                    />
                </div>

                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="text-[11px] text-slate-500">
                        {selectedIds.length === 0 ? (
                            <span className="text-amber-700 font-medium italic">
                                Note: Having 0 codes assigned means this reviewer has no assigned procurement domains yet.
                            </span>
                        ) : (
                            <span>{selectedIds.length} account code(s) will be associated with this user.</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition shadow-2xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving Assignments...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save Assigned Codes ({selectedIds.length})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
