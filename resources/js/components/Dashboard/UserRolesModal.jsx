import React, { useState, useEffect } from 'react';
import { Shield, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api';
import { SYSTEM_ROLE_OPTIONS } from '../../utils/roleLabels';

export const getUserRolesList = (u) => {
    if (!u) return [];
    if (Array.isArray(u.available_roles) && u.available_roles.length > 0) {
        return u.available_roles;
    }
    if (Array.isArray(u.roles) && u.roles.length > 0) {
        return u.roles;
    }
    return u.role ? [u.role] : [];
};

export const UserRolesModal = ({
    user: targetUser,
    currentUserRole = 'admin',
    onClose,
    onSaved,
}) => {
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (targetUser) {
            const initial = getUserRolesList(targetUser);
            setSelectedRoles(initial.length > 0 ? initial : ['end_user']);
            setError('');
        }
    }, [targetUser]);

    if (!targetUser) return null;

    const assignableRoles = SYSTEM_ROLE_OPTIONS.filter((r) => {
        if (r.value === 'super_admin' && currentUserRole !== 'super_admin') {
            return false;
        }
        return true;
    });

    const toggleRole = (roleValue) => {
        setError('');
        setSelectedRoles((prev) => {
            if (prev.includes(roleValue)) {
                if (prev.length === 1) return prev;
                return prev.filter((r) => r !== roleValue);
            }
            return [...prev, roleValue];
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (selectedRoles.length === 0) {
            setError('Please select at least one role for this user.');
            return;
        }
        setSaving(true);
        setError('');
        try {

            const primaryRole = selectedRoles.includes(targetUser.role)
                ? targetUser.role
                : selectedRoles[0];
            const res = await userService.updateRole(targetUser.id, primaryRole, selectedRoles);
            const updatedUser = res.data?.user || {
                ...targetUser,
                role: primaryRole,
                roles: selectedRoles,
                available_roles: selectedRoles,
            };
            if (onSaved) {
                onSaved(updatedUser, res.data?.message || 'User roles updated successfully.');
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update user roles.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-300 flex items-center justify-center shrink-0">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-extrabold truncate">
                                Manage Roles — {targetUser.name}
                            </h3>
                            <p className="text-[11px] text-slate-300 truncate">{targetUser.email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-600 font-medium">
                            Check one or more roles for this account. Multi-role users will choose their active role perspective on login.
                        </p>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                            {selectedRoles.length} Selected
                        </span>
                    </div>

                    {error && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                        {assignableRoles.map((r) => {
                            const checked = selectedRoles.includes(r.value);
                            return (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => toggleRole(r.value)}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                        checked
                                            ? 'bg-blue-50 border-blue-400 text-blue-950 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span
                                        className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
                                            checked
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-slate-300'
                                        }`}
                                    >
                                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-xs font-bold leading-tight">{r.label}</span>
                                        <span className="block text-[10px] text-slate-500 leading-snug mt-0.5">{r.desc}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || selectedRoles.length === 0}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>{saving ? 'Saving...' : 'Save Roles'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserRolesModal;
