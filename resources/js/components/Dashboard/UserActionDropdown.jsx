import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronDown,
    ToggleLeft,
    ToggleRight,
    SlidersHorizontal,
    Key,
    FileSpreadsheet,
    Layers,
    UserCheck,
    UserX,
    Trash2,
    Shield,
} from 'lucide-react';

export const UserActionDropdown = ({
    user,
    currentUser = null,
    isPending = false,
    isRejected = false,
    onToggleStatus = null,
    onChangeRole = null,
    onResetPassword = null,
    onManageCodes = null,
    onManageSystems = null,
    onApprove = null,
    onReject = null,
    onDelete = null,
    isProcessing = false,
    openUpward = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside or Escape key
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const isSelf = user?.id === currentUser?.id;
    const isTargetSuperAdmin = user?.role === 'super_admin';
    const canManageStatus = !isSelf && (!isTargetSuperAdmin || currentUser?.role === 'super_admin');
    const canChangeRole = onChangeRole && !isTargetSuperAdmin;
    const canResetPassword = onResetPassword && (currentUser?.role === 'super_admin' || !isTargetSuperAdmin);
    const canManageCodes = onManageCodes && user?.role === 'twg';
    const canDelete = onDelete && !isSelf && !isTargetSuperAdmin;

    return (
        <div className="relative inline-block text-left" ref={dropdownRef} data-action-dropdown>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                disabled={isProcessing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-50 ${
                    isOpen
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
                title="Open user actions menu"
            >
                <span>Action</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute right-0 w-56 rounded-xl bg-white border border-slate-200 shadow-2xl py-1 z-50 text-left animate-in fade-in zoom-in-95 divide-y divide-slate-100 ${
                        openUpward ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'
                    }`}
                    style={{ zIndex: 9999 }}
                >
                    {/* Header */}
                    <div className="px-3.5 py-2 bg-slate-50/80">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            User Actions
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                            {user.name}
                        </div>
                    </div>

                    {/* Pending Actions */}
                    {isPending ? (
                        <div className="p-1 space-y-0.5">
                            {onApprove && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onApprove();
                                    }}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight">Approve Registration</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Activate user account</div>
                                    </div>
                                </button>
                            )}
                            {onReject && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onReject();
                                    }}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight">Reject Registration</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Provide rejection reason</div>
                                    </div>
                                </button>
                            )}
                            {onManageSystems && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onManageSystems();
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight font-bold">Systems Access</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Configure portal access</div>
                                    </div>
                                </button>
                            )}
                        </div>
                    ) : isRejected ? (
                        <div className="p-1 space-y-0.5">
                            {onApprove && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onApprove();
                                    }}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight">Re-approve Account</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Restore &amp; activate</div>
                                    </div>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="p-1 space-y-0.5">
                            {/* Toggle Active / Deactivate */}
                            {canManageStatus && onToggleStatus && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onToggleStatus();
                                    }}
                                    disabled={isProcessing}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition cursor-pointer text-left ${
                                        user.is_active
                                            ? 'text-amber-700 hover:bg-amber-50'
                                            : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                >
                                    {user.is_active ? (
                                        <>
                                            <ToggleLeft className="w-4 h-4 text-amber-500 shrink-0" />
                                            <div>
                                                <div className="leading-tight font-bold">Deactivate Account</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Suspend account access</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <ToggleRight className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <div>
                                                <div className="leading-tight font-bold">Activate Account</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Enable login &amp; access</div>
                                            </div>
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Change Role */}
                            {canChangeRole && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onChangeRole();
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <SlidersHorizontal className="w-4 h-4 text-slate-500 shrink-0" />
                                    <div>
                                        <div className="leading-tight font-bold text-slate-900">Change Role</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Modify user role &amp; rank</div>
                                    </div>
                                </button>
                            )}

                            {/* Reset Password */}
                            {canResetPassword && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onResetPassword();
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <Key className="w-4 h-4 text-blue-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight font-bold">Reset Password</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Assign new password</div>
                                    </div>
                                </button>
                            )}

                            {/* TWG Assigned Account Codes */}
                            {canManageCodes && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onManageCodes();
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight font-bold">Assigned Codes</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Manage TWG account codes</div>
                                    </div>
                                </button>
                            )}

                            {/* Systems Access Permissions */}
                            {onManageSystems && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        onManageSystems();
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                >
                                    <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                                    <div>
                                        <div className="leading-tight font-bold">Systems Access</div>
                                        <div className="text-[10px] text-slate-400 font-normal">Configure portal permissions</div>
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Delete Action Section */}
                    {canDelete && (
                        <div className="p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    onDelete();
                                }}
                                disabled={isProcessing}
                                className="w-full px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                            >
                                <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                                <div>
                                    <div className="leading-tight">Delete Account</div>
                                    <div className="text-[10px] text-slate-400 font-normal">Permanently remove user</div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

