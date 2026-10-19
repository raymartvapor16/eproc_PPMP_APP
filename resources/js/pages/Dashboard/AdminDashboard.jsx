import React, { useState, useEffect, useMemo } from 'react';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PaginationControl } from '../../components/UI/PaginationControl';
import { AdminActivityLog } from '../../components/Dashboard/AdminActivityLog';
import { userService, ppmpService, officeService } from '../../services/api';
import {
    Users,
    UserPlus,
    Shield,
    FileSpreadsheet,
    Activity,
    RefreshCw,
    CheckCircle2,
    UserCheck,
    UserX,
    Key,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Search,
    Phone,
    Eye,
    PenTool,
    FileText,
    Check,
    X,
    Clock,
    AlertTriangle,
    Loader2,
    Filter,
    Building2,
    ArrowUpRight,
    SlidersHorizontal,
    BadgeAlert,
    Inbox,
    GitBranch,
    Landmark,
    Truck,
    Leaf,
} from 'lucide-react';
import { FundSourcesManagement } from '../../components/Dashboard/FundSourcesManagement';
import { ProcurementConditionsManagement } from '../../components/Dashboard/ProcurementConditionsManagement';
import { OtherTermsManagement } from '../../components/Dashboard/OtherTermsManagement';
import { SignatoriesManagement } from '../../components/Dashboard/SignatoriesManagement';
import { CreateUserModal } from '../../components/Dashboard/CreateUserModal';
import { UserSignatureModal } from '../../components/Dashboard/UserSignatureModal';

export const AdminDashboard = ({ data, user, onSelectPpmp, onNavigate, onReload }) => {
    // Current Active Tab: 'users' | 'amendments' | 'logs' | 'ppmps' | 'fund_sources' | 'conditions' | 'other_terms' | 'signatories'
    const [activeTab, setActiveTab] = useState('users');

    useEffect(() => {
        const handleAdminNav = (e) => {
            if (e.detail?.section) {
                setActiveTab(e.detail.section);
            }
        };
        const handleDataReload = () => {
            if (onReload) onReload();
        };
        window.addEventListener('admin:navigate_section', handleAdminNav);
        window.addEventListener('app:data_reload', handleDataReload);
        return () => {
            window.removeEventListener('admin:navigate_section', handleAdminNav);
            window.removeEventListener('app:data_reload', handleDataReload);
        };
    }, [onReload]);

    // ──────────────────────────────────────────────────────────────────────────
    // USERS MANAGEMENT STATE
    // ──────────────────────────────────────────────────────────────────────────
    const [usersList, setUsersList] = useState(data?.users || []);
    const [userSearch, setUserSearch] = useState('');
    const [userSubFilter, setUserSubFilter] = useState('all'); // 'all', 'pending', 'active', 'rejected'
    const [userPage, setUserPage] = useState(1);
    const [userPerPage, setUserPerPage] = useState(10);
    const [processingUserId, setProcessingUserId] = useState(null);
    const [userFeedback, setUserFeedback] = useState({ type: '', text: '' });

    // Modals for User management
    const [passwordModalUser, setPasswordModalUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const [rejectModalUser, setRejectModalUser] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [savingRejection, setSavingRejection] = useState(false);

    const [roleModalUser, setRoleModalUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState('');
    const [savingRole, setSavingRole] = useState(false);
    const [roleError, setRoleError] = useState('');

    const [signaturePreviewUser, setSignaturePreviewUser] = useState(null);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

    // ──────────────────────────────────────────────────────────────────────────
    // AMENDED & SUPPLEMENTAL STATE
    // ──────────────────────────────────────────────────────────────────────────
    const [amendmentsList, setAmendmentsList] = useState(data?.pending_amendments || []);
    const [loadingAmendments, setLoadingAmendments] = useState(false);
    const [amendmentFilter, setAmendmentFilter] = useState('PENDING_APPROVAL'); // 'ALL', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    const [amendmentTypeFilter, setAmendmentTypeFilter] = useState('ALL'); // 'ALL', 'SUPPLEMENTAL', 'AMENDMENT'
    const [amendmentSearch, setAmendmentSearch] = useState('');
    const [amendmentPage, setAmendmentPage] = useState(1);
    const [amendmentPerPage, setAmendmentPerPage] = useState(10);

    const [rejectAmendmentPpmp, setRejectAmendmentPpmp] = useState(null);
    const [rejectAmendmentRemarks, setRejectAmendmentRemarks] = useState('');
    const [rejectingAmendment, setRejectingAmendment] = useState(false);

    const [approvingAmendmentUuid, setApprovingAmendmentUuid] = useState(null);
    const [receivingUuid, setReceivingUuid] = useState(null);
    const [amendmentFeedback, setAmendmentFeedback] = useState({ type: '', text: '' });

    // ──────────────────────────────────────────────────────────────────────────
    // PPMP LIST OVERSIGHT STATE
    // ──────────────────────────────────────────────────────────────────────────
    const [ppmpsList, setPpmpsList] = useState(data?.recent_ppmps || []);
    const [loadingPpmps, setLoadingPpmps] = useState(false);
    const [ppmpSearch, setPpmpSearch] = useState('');
    const [ppmpStatusFilter, setPpmpStatusFilter] = useState('ALL');
    const [ppmpOfficeFilter, setPpmpOfficeFilter] = useState('ALL');
    const [ppmpPage, setPpmpPage] = useState(1);
    const [ppmpPerPage, setPpmpPerPage] = useState(10);
    const [ppmpPagination, setPpmpPagination] = useState(null);

    const officesList = data?.offices || [];
    const metrics = data?.metrics || {};

    // Sync users when data updates
    useEffect(() => {
        if (data?.users) {
            setUsersList(data.users);
        }
    }, [data?.users]);

    // Fetch full amendments list when tab is 'amendments'
    const fetchAmendments = async () => {
        setLoadingAmendments(true);
        try {
            const params = { per_page: 100 };
            if (amendmentFilter !== 'ALL') {
                params.amendment_status = amendmentFilter;
            }
            const res = await ppmpService.getAll(params);
            const items = res.data?.data || res.data || [];
            // If filter is ALL, ensure we show all PPMPs that had or have an amendment status
            const filtered = items.filter(p => p.amendment_status || p.parent_id);
            setAmendmentsList(filtered);
        } catch (e) {
            console.error('Failed to load amendments', e);
        } finally {
            setLoadingAmendments(false);
        }
    };

    // Fetch full PPMP list when tab is 'ppmps'
    const fetchPpmps = async () => {
        setLoadingPpmps(true);
        try {
            const params = {
                page: ppmpPage,
                per_page: ppmpPerPage,
            };
            if (ppmpSearch) params.search = ppmpSearch;
            if (ppmpStatusFilter !== 'ALL') params.status = ppmpStatusFilter;
            if (ppmpOfficeFilter !== 'ALL') params.office_id = ppmpOfficeFilter;

            const res = await ppmpService.getAll(params);
            if (res.data?.data) {
                setPpmpsList(res.data.data);
                setPpmpPagination({
                    current_page: res.data.current_page,
                    last_page: res.data.last_page,
                    total: res.data.total,
                });
            } else {
                setPpmpsList(res.data || []);
            }
        } catch (e) {
            console.error('Failed to load PPMPs', e);
        } finally {
            setLoadingPpmps(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'amendments') {
            fetchAmendments();
        }
    }, [activeTab, amendmentFilter]);

    useEffect(() => {
        if (activeTab === 'ppmps') {
            fetchPpmps();
        }
    }, [activeTab, ppmpPage, ppmpPerPage, ppmpStatusFilter, ppmpOfficeFilter]);

    // Auto-dismiss user feedback
    useEffect(() => {
        if (userFeedback.text) {
            const t = setTimeout(() => setUserFeedback({ type: '', text: '' }), 4000);
            return () => clearTimeout(t);
        }
    }, [userFeedback]);

    // Auto-dismiss amendment feedback
    useEffect(() => {
        if (amendmentFeedback.text) {
            const t = setTimeout(() => setAmendmentFeedback({ type: '', text: '' }), 4000);
            return () => clearTimeout(t);
        }
    }, [amendmentFeedback]);

    // ──────────────────────────────────────────────────────────────────────────
    // USER ACTIONS
    // ──────────────────────────────────────────────────────────────────────────
    const handleApproveUser = async (targetUser) => {
        if (!window.confirm(`Approve registration for ${targetUser.name}?`)) return;
        setProcessingUserId(targetUser.id);
        try {
            const res = await userService.approve(targetUser.id);
            setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: true, approval_status: 'approved', rejection_reason: null } : u));
            setUserFeedback({ type: 'success', text: res.data.message || 'User approved successfully.' });
            if (onReload) onReload();
        } catch (e) {
            setUserFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to approve user.' });
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleRejectUserSubmit = async (e) => {
        e.preventDefault();
        if (!rejectModalUser) return;
        setSavingRejection(true);
        try {
            const res = await userService.reject(rejectModalUser.id, rejectionReason);
            setUsersList(prev => prev.map(u => u.id === rejectModalUser.id ? { ...u, is_active: false, approval_status: 'rejected', rejection_reason: rejectionReason } : u));
            setUserFeedback({ type: 'success', text: res.data.message || 'User registration rejected.' });
            setRejectModalUser(null);
            setRejectionReason('');
            if (onReload) onReload();
        } catch (e) {
            setUserFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to reject user.' });
        } finally {
            setSavingRejection(false);
        }
    };

    const handleToggleStatus = async (targetUser) => {
        if (targetUser.role === 'super_admin') {
            alert('Cannot toggle status of Super Administrator.');
            return;
        }
        setProcessingUserId(targetUser.id);
        try {
            const res = await userService.toggleStatus(targetUser.id);
            setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: !u.is_active } : u));
            setUserFeedback({ type: 'success', text: res.data.message || 'User status updated.' });
            if (onReload) onReload();
        } catch (e) {
            setUserFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to toggle status.' });
        } finally {
            setProcessingUserId(null);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');
        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }
        setSavingPassword(true);
        try {
            const res = await userService.changePassword(passwordModalUser.id, newPassword);
            setUserFeedback({ type: 'success', text: res.data.message || 'Password updated.' });
            setPasswordModalUser(null);
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            setPasswordError(e.response?.data?.message || 'Failed to update password.');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleRoleSubmit = async (e) => {
        e.preventDefault();
        setRoleError('');
        if (!selectedRole) {
            setRoleError('Please select a valid role.');
            return;
        }
        setSavingRole(true);
        try {
            const res = await userService.updateRole(roleModalUser.id, selectedRole);
            setUsersList(prev => prev.map(u => u.id === roleModalUser.id ? { ...u, role: selectedRole } : u));
            setUserFeedback({ type: 'success', text: res.data.message || 'Role updated successfully.' });
            setRoleModalUser(null);
            setSelectedRole('');
            if (onReload) onReload();
        } catch (e) {
            setRoleError(e.response?.data?.message || 'Failed to update role.');
        } finally {
            setSavingRole(false);
        }
    };

    const handleDeleteUser = async (targetUser) => {
        if (!window.confirm(`Permanently delete account for "${targetUser.name}"? This cannot be undone.`)) return;
        setProcessingUserId(targetUser.id);
        try {
            const res = await userService.delete(targetUser.id);
            setUsersList(prev => prev.filter(u => u.id !== targetUser.id));
            setUserFeedback({ type: 'success', text: res.data.message || 'User deleted successfully.' });
            if (onReload) onReload();
        } catch (e) {
            setUserFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to delete user.' });
        } finally {
            setProcessingUserId(null);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // AMENDMENT ACTIONS
    // ──────────────────────────────────────────────────────────────────────────
    const handleReceiveAmendment = async (ppmp) => {
        setReceivingUuid(ppmp.uuid);
        try {
            await ppmpService.receive(ppmp.uuid);
            setAmendmentFeedback({ type: 'success', text: 'Amendment request officially marked as received.' });
            fetchAmendments();
            if (onReload) onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (e) {
            setAmendmentFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to receive amendment request.' });
        } finally {
            setReceivingUuid(null);
        }
    };

    const handleApproveAmendment = async (ppmp) => {
        if (!window.confirm(`Approve amendment request for PPMP No. ${ppmp.ppmp_number || ppmp.title}? A revised draft PPMP will be initialized.`)) return;
        setApprovingAmendmentUuid(ppmp.uuid);
        try {
            const res = await ppmpService.approveAmendment(ppmp.uuid);
            setAmendmentFeedback({ type: 'success', text: res.data.message || 'Amendment request approved successfully.' });
            fetchAmendments();
            if (onReload) onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (e) {
            setAmendmentFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to approve amendment.' });
        } finally {
            setApprovingAmendmentUuid(null);
        }
    };

    const handleRejectAmendmentSubmit = async (e) => {
        e.preventDefault();
        if (!rejectAmendmentPpmp) return;
        if (!rejectAmendmentRemarks.trim()) {
            alert('Please specify the disapproval remarks.');
            return;
        }
        setRejectingAmendment(true);
        try {
            const res = await ppmpService.rejectAmendment(rejectAmendmentPpmp.uuid, { remarks: rejectAmendmentRemarks });
            setAmendmentFeedback({ type: 'success', text: res.data.message || 'Amendment request disapproved.' });
            setRejectAmendmentPpmp(null);
            setRejectAmendmentRemarks('');
            fetchAmendments();
            if (onReload) onReload();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (e) {
            setAmendmentFeedback({ type: 'error', text: e.response?.data?.message || 'Failed to disapprove amendment.' });
        } finally {
            setRejectingAmendment(false);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // COMPUTED COUNTS
    // ──────────────────────────────────────────────────────────────────────────
    const pendingUsersCount = usersList.filter(u => !u.is_active && u.approval_status !== 'rejected').length;
    const activeUsersCount = usersList.filter(u => u.is_active && u.approval_status !== 'rejected').length;
    const rejectedUsersCount = usersList.filter(u => u.approval_status === 'rejected').length;
    const pendingAmendmentsCount = metrics.pending_amendments || amendmentsList.filter(a => a.amendment_status === 'PENDING_APPROVAL').length;

    // Filtered Users
    const filteredUsers = useMemo(() => {
        let list = usersList;
        if (userSubFilter === 'pending') {
            list = list.filter(u => !u.is_active && u.approval_status !== 'rejected');
        } else if (userSubFilter === 'active') {
            list = list.filter(u => u.is_active && u.approval_status !== 'rejected');
        } else if (userSubFilter === 'rejected') {
            list = list.filter(u => u.approval_status === 'rejected');
        }
        if (userSearch) {
            const q = userSearch.toLowerCase();
            list = list.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                u.office?.name?.toLowerCase().includes(q) ||
                u.office?.code?.toLowerCase().includes(q) ||
                u.phone_number?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [usersList, userSubFilter, userSearch]);

    // Filtered Amendments
    const filteredAmendments = useMemo(() => {
        let list = amendmentsList;
        if (amendmentTypeFilter !== 'ALL') {
            list = list.filter(a => (a.requested_amendment_type || a.amendment_type) === amendmentTypeFilter);
        }
        if (amendmentSearch) {
            const q = amendmentSearch.toLowerCase();
            list = list.filter(a =>
                a.ppmp_number?.toLowerCase().includes(q) ||
                a.tracking_number?.toLowerCase().includes(q) ||
                a.title?.toLowerCase().includes(q) ||
                a.office?.name?.toLowerCase().includes(q) ||
                a.requested_amendment_reason?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [amendmentsList, amendmentTypeFilter, amendmentSearch]);

    // Role display label & color mapping
    const getRoleBadge = (role) => {
        switch (role) {
            case 'super_admin':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Super Administrator</span>;
            case 'admin':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Administrator</span>;
            case 'budget_officer':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800">Budget Officer</span>;
            case 'oppmo':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800">OPPMO</span>;
            case 'twg':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">TWG</span>;
            case 'head':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800">Office Head</span>;
            case 'authorized_staff':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 border border-teal-300">Authorize Staff</span>;
            case 'pacco':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">PACCO Reviewer</span>;
            case 'monitor':
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">Monitoring Officer</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">End User</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Admin Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg border border-blue-400/30 shrink-0">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-black tracking-tight text-white">
                                Administrator Control Center
                            </h1>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                                Role: Admin
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                            User Management • Amended &amp; Supplemental Review • System Activity Logs • Provincial PPMP List
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => {
                            if (onReload) onReload();
                            if (activeTab === 'amendments') fetchAmendments();
                            if (activeTab === 'ppmps') fetchPpmps();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        title="Reload administrative data"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Top Stat Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Users */}
                <div
                    onClick={() => { setActiveTab('users'); setUserSubFilter('all'); }}
                    className={`bg-white p-5 rounded-xl border transition shadow-xs cursor-pointer hover:border-blue-400 ${activeTab === 'users' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Users Directory</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{usersList.length}</span>
                        <span className="text-xs text-slate-500">accounts</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-700 font-medium">{activeUsersCount} active</span>
                        {pendingUsersCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
                                <BadgeAlert className="w-3 h-3" /> {pendingUsersCount} pending
                            </span>
                        ) : (
                            <span className="text-slate-400">0 pending</span>
                        )}
                    </div>
                </div>

                {/* Metric 2: Amendments */}
                <div
                    onClick={() => setActiveTab('amendments')}
                    className={`bg-white p-5 rounded-xl border transition shadow-xs cursor-pointer hover:border-purple-400 ${activeTab === 'amendments' ? 'ring-2 ring-purple-500 border-purple-500' : 'border-slate-200'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amended / Supplemental</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <GitBranch className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{pendingAmendmentsCount}</span>
                        <span className="text-xs text-purple-700 font-semibold">awaiting action</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Revisions &amp; Supplemental</span>
                        <span className="text-purple-600 font-bold">Review Mode</span>
                    </div>
                </div>

                {/* Metric 3: PPMP Oversight */}
                <div
                    onClick={() => setActiveTab('ppmps')}
                    className={`bg-white p-5 rounded-xl border transition shadow-xs cursor-pointer hover:border-emerald-400 ${activeTab === 'ppmps' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PPMP Master List</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{metrics.total_ppmps || ppmpsList.length}</span>
                        <span className="text-xs text-slate-500">submitted</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <span>Total Budget</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(metrics.total_budget || 0)}</span>
                    </div>
                </div>

                {/* Metric 4: System Logs */}
                <div
                    onClick={() => setActiveTab('logs')}
                    className={`bg-white p-5 rounded-xl border transition shadow-xs cursor-pointer hover:border-indigo-400 ${activeTab === 'logs' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Logs &amp; Audit</span>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Activity className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{metrics.total_logs || 'Live'}</span>
                        <span className="text-xs text-slate-500">events</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-indigo-600 font-semibold">Audit Trail</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Tracking
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-1.5 flex items-center gap-2 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'users'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Manage Users</span>
                    {pendingUsersCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            activeTab === 'users' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                            {pendingUsersCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('amendments')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'amendments'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <GitBranch className="w-4 h-4" />
                    <span>Amended / Supplemental</span>
                    {pendingAmendmentsCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            activeTab === 'amendments' ? 'bg-white text-purple-700' : 'bg-purple-100 text-purple-800'
                        }`}>
                            {pendingAmendmentsCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'logs'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    <span>System Logs</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('ppmps')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'ppmps'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>PPMP Master List</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('fund_sources')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'fund_sources'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Landmark className="w-4 h-4" />
                    <span>Sources of Fund</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('conditions')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'conditions'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Truck className="w-4 h-4" />
                    <span>Delivery Conditions</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('other_terms')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'other_terms'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Leaf className="w-4 h-4" />
                    <span>Other Terms &amp; Green Specs</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('signatories')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'signatories'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <PenTool className="w-4 h-4" />
                    <span>Official Signatories (APP / PPMP)</span>
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: USERS MANAGEMENT                                          */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
                    {/* Header + Feedback */}
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                User Accounts Management
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Review registrations, activate/deactivate accounts, reset credentials, and assign user roles.
                            </p>
                        </div>
                    </div>

                    {userFeedback.text && (
                        <div className={`mx-5 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                            userFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                            {userFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                            <span>{userFeedback.text}</span>
                        </div>
                    )}

                    {/* Filter Bar */}
                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Sub tabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold shrink-0 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => { setUserSubFilter('all'); setUserPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${userSubFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                All ({usersList.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserSubFilter('pending'); setUserPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${userSubFilter === 'pending' ? 'bg-white text-amber-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                <span>Pending</span>
                                {pendingUsersCount > 0 && (
                                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">
                                        {pendingUsersCount}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserSubFilter('active'); setUserPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${userSubFilter === 'active' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Active ({activeUsersCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserSubFilter('rejected'); setUserPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${userSubFilter === 'rejected' ? 'bg-white text-rose-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Rejected ({rejectedUsersCount})
                            </button>
                        </div>

                        {/* Search & Add User */}
                        <div className="flex items-center gap-2 flex-1 max-w-lg">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                                    placeholder="Search by name, email, office, phone..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateUserModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer shrink-0"
                                title="Add New User Account"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add User</span>
                            </button>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="overflow-x-auto border-t border-slate-100">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">User &amp; Contact</th>
                                    <th className="p-3">Assigned Office</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Documents</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                            No user accounts found matching your filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalPages = Math.ceil(filteredUsers.length / userPerPage) || 1;
                                        const safePage = Math.min(userPage, totalPages);
                                        const startIndex = (safePage - 1) * userPerPage;
                                        const paginated = filteredUsers.slice(startIndex, startIndex + userPerPage);

                                        return paginated.map((u) => {
                                            const isPending = !u.is_active && u.approval_status !== 'rejected';
                                            const isRejected = u.approval_status === 'rejected';

                                            return (
                                                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900">{u.name}</div>
                                                        <div className="text-slate-500 text-[11px]">{u.email}</div>
                                                        {u.phone_number && (
                                                            <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                                                                <Phone className="w-3 h-3" /> {u.phone_number}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-slate-700">
                                                        <div className="font-medium text-slate-800">{u.office?.name || '—'}</div>
                                                        {u.office?.code && (
                                                            <span className="font-mono text-[10px] text-slate-500 font-semibold">
                                                                {u.office.code}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        {getRoleBadge(u.role)}
                                                        {u.designation && (
                                                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                                                                {u.designation}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSignaturePreviewUser(u)}
                                                                className="inline-flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-900 font-medium underline underline-offset-2 hover:bg-indigo-50 px-1 py-0.5 rounded transition cursor-pointer"
                                                                title={u.signature_path ? "View / Manage Signature" : "Add / Upload Signature"}
                                                            >
                                                                <PenTool className="w-3 h-3 text-indigo-600" />
                                                                <span>{u.signature_path ? 'Signature' : 'No Signature (Add)'}</span>
                                                            </button>
                                                            {u.authorization_letter_path && (
                                                                <a
                                                                    href={`/api/users/${u.id}/authorization-letter`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 font-medium underline underline-offset-2 hover:bg-teal-50 px-1 py-0.5 rounded transition"
                                                                    title="View Official Authorization Letter"
                                                                >
                                                                    <FileText className="w-3 h-3 text-teal-600" />
                                                                    <span>Letter PDF</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        {isRejected ? (
                                                            <div className="flex flex-col gap-0.5 items-start">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[11px] font-semibold">
                                                                    <UserX className="w-3 h-3 text-rose-600" /> Rejected
                                                                </span>
                                                                {u.rejection_reason && (
                                                                    <span className="text-[10px] text-slate-500 max-w-[140px] truncate" title={u.rejection_reason}>
                                                                        {u.rejection_reason}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : isPending ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold animate-pulse">
                                                                <Clock className="w-3 h-3" /> Pending Review
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                            {isPending ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApproveUser(u)}
                                                                        disabled={processingUserId === u.id}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                                                        title="Approve registration"
                                                                    >
                                                                        <UserCheck className="w-3 h-3" /> Approve
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setRejectModalUser(u); setRejectionReason(''); }}
                                                                        disabled={processingUserId === u.id}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                                                        title="Reject registration"
                                                                    >
                                                                        <UserX className="w-3 h-3" /> Reject
                                                                    </button>
                                                                </>
                                                            ) : isRejected ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApproveUser(u)}
                                                                        disabled={processingUserId === u.id}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                                                        title="Re-approve user"
                                                                    >
                                                                        <UserCheck className="w-3 h-3" /> Approve
                                                                    </button>
                                                                    {u.id !== user?.id && u.role !== 'super_admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteUser(u)}
                                                                            disabled={processingUserId === u.id}
                                                                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                                            title="Delete account"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {u.id !== user?.id && u.role !== 'super_admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleStatus(u)}
                                                                            disabled={processingUserId === u.id}
                                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                                                                                u.is_active
                                                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                                                                    : 'bg-slate-200 hover:bg-emerald-600 hover:text-white text-slate-700'
                                                                            }`}
                                                                            title={u.is_active ? 'Deactivate account' : 'Activate account'}
                                                                        >
                                                                            {u.is_active ? <><ToggleLeft className="w-3 h-3" /> Deactivate</> : <><ToggleRight className="w-3 h-3" /> Activate</>}
                                                                        </button>
                                                                    )}
                                                                    {u.role !== 'super_admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setRoleModalUser(u); setSelectedRole(u.role); setRoleError(''); }}
                                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition cursor-pointer"
                                                                            title="Change User Role"
                                                                        >
                                                                            <SlidersHorizontal className="w-3 h-3 text-slate-500" /> Role
                                                                        </button>
                                                                    )}
                                                                    {u.role !== 'super_admin' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setPasswordModalUser(u); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }}
                                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition cursor-pointer"
                                                                            title="Reset Password"
                                                                        >
                                                                            <Key className="w-3 h-3" /> Pass
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredUsers.length > 0 && (() => {
                        const totalItems = filteredUsers.length;
                        const totalPages = Math.ceil(totalItems / userPerPage) || 1;
                        const safePage = Math.min(userPage, totalPages);
                        const startIndex = (safePage - 1) * userPerPage;
                        const endIndex = safePage * userPerPage;
                        return (
                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                <PaginationControl
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    onPageChange={setUserPage}
                                    perPage={userPerPage}
                                    onPerPageChange={setUserPerPage}
                                    totalEntries={totalItems}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                />
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: AMENDED & SUPPLEMENTAL MANAGEMENT                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'amendments' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-purple-600" />
                                Amended &amp; Supplemental PPMP Requests
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Formally receive, evaluate justifications, and approve or disapprove requests for PPMP Amendments and Supplemental Plans.
                            </p>
                        </div>
                    </div>

                    {amendmentFeedback.text && (
                        <div className={`mx-5 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                            amendmentFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                            {amendmentFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                            <span>{amendmentFeedback.text}</span>
                        </div>
                    )}

                    {/* Filter & Search Bar */}
                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Status subtabs */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold shrink-0 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => { setAmendmentFilter('PENDING_APPROVAL'); setAmendmentPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${amendmentFilter === 'PENDING_APPROVAL' ? 'bg-white text-purple-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                <span>Pending Approval</span>
                                {pendingAmendmentsCount > 0 && (
                                    <span className="px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded-full text-[10px] font-bold">
                                        {pendingAmendmentsCount}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAmendmentFilter('APPROVED'); setAmendmentPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${amendmentFilter === 'APPROVED' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Approved
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAmendmentFilter('REJECTED'); setAmendmentPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${amendmentFilter === 'REJECTED' ? 'bg-white text-rose-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Disapproved
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAmendmentFilter('ALL'); setAmendmentPage(1); }}
                                className={`px-3 py-1.5 rounded-md transition cursor-pointer ${amendmentFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                All Requests
                            </button>
                        </div>

                        {/* Search & Type filter */}
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <select
                                value={amendmentTypeFilter}
                                onChange={(e) => setAmendmentTypeFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="ALL">All Types</option>
                                <option value="SUPPLEMENTAL">Supplemental</option>
                                <option value="AMENDMENT">Amendment</option>
                            </select>

                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={amendmentSearch}
                                    onChange={(e) => { setAmendmentSearch(e.target.value); setAmendmentPage(1); }}
                                    placeholder="Search by PPMP#, tracking, office, reason..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Amendments Table */}
                    <div className="overflow-x-auto border-t border-slate-100">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">PPMP &amp; Tracking</th>
                                    <th className="p-3">Office</th>
                                    <th className="p-3">Request Type &amp; Scope</th>
                                    <th className="p-3">Justification / Reason</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingAmendments ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-500">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                                            <span>Loading amendment requests...</span>
                                        </td>
                                    </tr>
                                ) : filteredAmendments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                            No amendment or supplemental requests match this filter.
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalPages = Math.ceil(filteredAmendments.length / amendmentPerPage) || 1;
                                        const safePage = Math.min(amendmentPage, totalPages);
                                        const startIndex = (safePage - 1) * amendmentPerPage;
                                        const paginated = filteredAmendments.slice(startIndex, startIndex + amendmentPerPage);

                                        return paginated.map((ppmp) => {
                                            const type = ppmp.requested_amendment_type || ppmp.amendment_type || 'SUPPLEMENTAL';
                                            const scope = ppmp.requested_amendment_scope || ppmp.amendment_scope || 'ALL';
                                            const reason = ppmp.requested_amendment_reason || ppmp.amendment_reason || '—';
                                            const isPending = ppmp.amendment_status === 'PENDING_APPROVAL';
                                            const isReceived = Boolean(ppmp.admin_received_at);

                                            return (
                                                <tr key={ppmp.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                            <span>{ppmp.ppmp_number || ppmp.title}</span>
                                                        </div>
                                                        <div className="text-[11px] font-mono text-purple-700 font-semibold mt-0.5">
                                                            {ppmp.tracking_number}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            FY {ppmp.fiscal_year} • {formatCurrency(ppmp.total_budget || 0)}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-slate-700">
                                                        <div className="font-semibold text-slate-900">{ppmp.office?.name || '—'}</div>
                                                        {ppmp.office?.code && (
                                                            <span className="font-mono text-[10px] text-slate-500 font-bold">
                                                                {ppmp.office.code}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                type === 'SUPPLEMENTAL' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                                {type === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                Scope: <strong>{scope}</strong>
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 max-w-xs">
                                                        <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed" title={reason}>
                                                            {reason}
                                                        </p>
                                                        {ppmp.amendment_requested_at && (
                                                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                <span>Requested: {formatDate(ppmp.amendment_requested_at)}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        {isPending ? (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold animate-pulse">
                                                                    <Clock className="w-3 h-3" /> Pending Approval
                                                                </span>
                                                                {isReceived ? (
                                                                    <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                                                                        <Check className="w-3 h-3 text-emerald-600" /> Received by Admin
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 font-medium">
                                                                        Not yet received
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : ppmp.amendment_status === 'APPROVED' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approved
                                                            </span>
                                                        ) : ppmp.amendment_status === 'REJECTED' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[11px] font-bold">
                                                                <X className="w-3 h-3 text-rose-600" /> Disapproved
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                            {isPending && !isReceived && (
                                                                <button
                                                                    type="button"
                                                                    disabled={receivingUuid === ppmp.uuid}
                                                                    onClick={() => handleReceiveAmendment(ppmp)}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                                                    title="Officially acknowledge receipt of this request"
                                                                >
                                                                    <Inbox className="w-3 h-3" /> Receive
                                                                </button>
                                                            )}
                                                            {isPending && isReceived && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        disabled={approvingAmendmentUuid === ppmp.uuid}
                                                                        onClick={() => handleApproveAmendment(ppmp)}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                                                                        title="Approve Amendment and initialize revision PPMP"
                                                                    >
                                                                        <Check className="w-3 h-3" /> Approve
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setRejectAmendmentPpmp(ppmp); setRejectAmendmentRemarks(''); }}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                                        title="Disapprove Amendment Request"
                                                                    >
                                                                        <X className="w-3 h-3" /> Disapprove
                                                                    </button>
                                                                </>
                                                            )}
                                                            {(!isPending || isReceived) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onSelectPpmp && onSelectPpmp(ppmp.uuid)}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                                                                    title="View full PPMP details"
                                                                >
                                                                    <Eye className="w-3 h-3" /> View
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredAmendments.length > 0 && (() => {
                        const totalItems = filteredAmendments.length;
                        const totalPages = Math.ceil(totalItems / amendmentPerPage) || 1;
                        const safePage = Math.min(amendmentPage, totalPages);
                        const startIndex = (safePage - 1) * amendmentPerPage;
                        const endIndex = safePage * amendmentPerPage;
                        return (
                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                <PaginationControl
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    onPageChange={setAmendmentPage}
                                    perPage={amendmentPerPage}
                                    onPerPageChange={setAmendmentPerPage}
                                    totalEntries={totalItems}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                />
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: SYSTEM LOGS & AUDIT TRAIL                                */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'logs' && (
                <div className="space-y-4">
                    <AdminActivityLog />
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 4: PPMP MASTER LIST                                          */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'ppmps' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                Provincial PPMP Management List
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Comprehensive directory of all Project Procurement Management Plans submitted across offices.
                            </p>
                        </div>
                    </div>

                    {/* Filter controls */}
                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                            {/* Search */}
                            <div className="relative min-w-[200px] flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={ppmpSearch}
                                    onChange={(e) => setPpmpSearch(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchPpmps(); }}
                                    placeholder="Search by PPMP#, tracking, title..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                />
                            </div>

                            {/* Office Filter */}
                            <select
                                value={ppmpOfficeFilter}
                                onChange={(e) => { setPpmpOfficeFilter(e.target.value); setPpmpPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="ALL">All Departments / Offices</option>
                                {officesList.map((off) => (
                                    <option key={off.id} value={off.id}>
                                        {off.code ? `[${off.code}] ` : ''}{off.name}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                value={ppmpStatusFilter}
                                onChange={(e) => { setPpmpStatusFilter(e.target.value); setPpmpPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="DRAFT">Draft</option>
                                <option value="HEAD_PENDING">Pending Office Head</option>
                                <option value="BUDGET_OFFICER_REVIEW">Budget Officer Review</option>
                                <option value="OPPMO_REVIEW">OPPMO Review</option>
                                <option value="TWG_REVIEW">TWG Review</option>
                                <option value="READY_TO_PRINT">Ready to Print / Approved</option>
                                <option value="HEAD_RETURNED">Returned by Head</option>
                                <option value="BUDGET_OFFICER_RETURNED">Returned by Budget</option>
                                <option value="OPPMO_RETURNED">Returned by OPPMO</option>
                                <option value="TWG_RETURNED">Returned by TWG</option>
                            </select>
                        </div>
                    </div>

                    {/* PPMPs Table */}
                    <div className="overflow-x-auto border-t border-slate-100">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Tracking &amp; PPMP No.</th>
                                    <th className="p-3">Office</th>
                                    <th className="p-3">Project Title</th>
                                    <th className="p-3">Fiscal Year</th>
                                    <th className="p-3">Estimated Budget</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingPpmps ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                                            <span>Loading PPMP records...</span>
                                        </td>
                                    </tr>
                                ) : ppmpsList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                            No Project Procurement Management Plans found.
                                        </td>
                                    </tr>
                                ) : (
                                    ppmpsList.map((ppmp) => (
                                        <tr key={ppmp.id} className="hover:bg-slate-50/80 transition">
                                            <td className="p-3 font-medium">
                                                <div className="font-bold text-slate-900">{ppmp.ppmp_number || 'Pending No.'}</div>
                                                <div className="text-[11px] font-mono text-blue-700 font-semibold">{ppmp.tracking_number}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-800">{ppmp.office?.name || '—'}</div>
                                                {ppmp.office?.code && (
                                                    <span className="font-mono text-[10px] text-slate-500 font-bold">{ppmp.office.code}</span>
                                                )}
                                            </td>
                                            <td className="p-3 max-w-sm">
                                                <div className="font-semibold text-slate-900 truncate" title={ppmp.title}>
                                                    {ppmp.title}
                                                </div>
                                                {ppmp.creator && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Prepared by: {ppmp.creator.name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono text-slate-700 font-semibold">FY {ppmp.fiscal_year}</span>
                                                <div className="text-[10px] text-slate-400">{ppmp.plan_type}</div>
                                            </td>
                                            <td className="p-3 font-bold text-slate-900">
                                                {formatCurrency(ppmp.total_budget || 0)}
                                            </td>
                                            <td className="p-3">
                                                <StatusBadge status={ppmp.status} />
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => onSelectPpmp && onSelectPpmp(ppmp.uuid)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>View</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PPMP Pagination */}
                    {ppmpPagination && ppmpPagination.total > ppmpPerPage && (
                        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                            <PaginationControl
                                currentPage={ppmpPage}
                                totalPages={ppmpPagination.last_page}
                                onPageChange={setPpmpPage}
                                perPage={ppmpPerPage}
                                onPerPageChange={setPpmpPerPage}
                                totalEntries={ppmpPagination.total}
                                startIndex={(ppmpPage - 1) * ppmpPerPage}
                                endIndex={ppmpPage * ppmpPerPage}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 5: SOURCES OF FUND & REVIEW ROUTING                           */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'fund_sources' && (
                <FundSourcesManagement />
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 6: PROCUREMENT CONDITIONS & DELIVERY TERMS                    */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'conditions' && (
                <ProcurementConditionsManagement />
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 7: OTHER TERMS & GREEN SPECIFICATIONS                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'other_terms' && (
                <OtherTermsManagement />
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* TAB 8: OFFICIAL SIGNATORIES MANAGEMENT (APP & PPMP)               */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'signatories' && (
                <SignatoriesManagement initialSignatories={data?.signatories} onReload={onReload} />
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* MODALS                                                           */}
            {/* ══════════════════════════════════════════════════════════════════ */}

            {/* Password Reset Modal */}
            {passwordModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-bold">Reset Password — {passwordModalUser.name}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPasswordModalUser(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-5 space-y-4">
                            {passwordError && (
                                <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium border border-rose-200">
                                    {passwordError}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword || ''}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password (min. 6 characters)"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword || ''}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setPasswordModalUser(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingPassword}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {savingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reject User Modal */}
            {rejectModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserX className="w-4 h-4 text-rose-300" />
                                <h3 className="text-sm font-bold">Reject User Registration</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRejectModalUser(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleRejectUserSubmit} className="p-5 space-y-4">
                            <p className="text-xs text-slate-600">
                                You are rejecting the registration request for <strong>{rejectModalUser.name}</strong> ({rejectModalUser.email}).
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason for Rejection</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={rejectionReason || ''}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Specify reason (e.g. Incomplete access form, Incorrect office assigned, Invalid authorization letter)"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setRejectModalUser(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRejection}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {savingRejection ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Role Modal */}
            {roleModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-bold">Assign Role — {roleModalUser.name}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRoleModalUser(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleRoleSubmit} className="p-5 space-y-4">
                            {roleError && (
                                <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs font-medium border border-rose-200">
                                    {roleError}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select System Role</label>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="end_user">End User / Project In-Charge</option>
                                    <option value="head">Department / Office Head</option>
                                    <option value="authorized_staff">Authorize Staff (Acting Head)</option>
                                    <option value="budget_officer">Provincial Budget Officer</option>
                                    <option value="oppmo">OPPMO / BAC Secretariat</option>
                                    <option value="twg">BAC-TWG Evaluator</option>
                                    <option value="pacco">PACCO Reviewer (Provincial Accounting)</option>
                                    <option value="monitor">OPPMO Monitoring Officer</option>
                                    <option value="admin">Administrator</option>
                                    {user?.role === 'super_admin' && (
                                        <option value="super_admin">Super Administrator</option>
                                    )}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setRoleModalUser(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRole}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {savingRole ? 'Saving...' : 'Save Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Signature Preview & Update Modal */}
            <UserSignatureModal
                user={signaturePreviewUser}
                isOpen={Boolean(signaturePreviewUser)}
                onClose={() => setSignaturePreviewUser(null)}
                onUpdated={(updatedUser) => {
                    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                    setSignaturePreviewUser(null);
                    setUserFeedback({ type: 'success', text: `Signature for ${updatedUser.name} updated successfully.` });
                }}
            />

            {/* Create User Modal */}
            <CreateUserModal
                isOpen={isCreateUserModalOpen}
                onClose={() => setIsCreateUserModalOpen(false)}
                offices={officesList}
                currentUserRole={user?.role}
                onSuccess={(newUser, msg) => {
                    setUsersList(prev => [newUser, ...prev]);
                    setUserFeedback({ type: 'success', text: msg || 'User created successfully.' });
                }}
            />

            {/* Disapprove Amendment Modal */}
            {rejectAmendmentPpmp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <X className="w-4 h-4 text-rose-300" />
                                <h3 className="text-sm font-bold">Disapprove Amendment / Supplemental Request</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRejectAmendmentPpmp(null)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleRejectAmendmentSubmit} className="p-5 space-y-4">
                            <p className="text-xs text-slate-600">
                                PPMP No: <strong>{rejectAmendmentPpmp.ppmp_number || rejectAmendmentPpmp.title}</strong>
                                <br />
                                Office: <strong>{rejectAmendmentPpmp.office?.name}</strong>
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Disapproval Remarks &amp; Feedback <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={rejectAmendmentRemarks || ''}
                                    onChange={(e) => setRejectAmendmentRemarks(e.target.value)}
                                    placeholder="Provide detailed reason why this request is disapproved so the end-user can rectify..."
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setRejectAmendmentPpmp(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectingAmendment}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {rejectingAmendment ? 'Disapproving...' : 'Confirm Disapproval'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default AdminDashboard;
