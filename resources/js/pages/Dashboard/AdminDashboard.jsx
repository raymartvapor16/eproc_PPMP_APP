import React, { useState, useEffect, useMemo } from 'react';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PaginationControl } from '../../components/UI/PaginationControl';
import { AdminActivityLog } from '../../components/Dashboard/AdminActivityLog';
import { UnifiedSecurityControls } from '../../components/Dashboard/UnifiedSecurityControls';
import { getSupplementalKindInfo, isInfrastructurePpmp, getPpmpProjectTypeLabel } from '../../utils/workflowHelpers';
import { userService, ppmpService, officeService } from '../../services/api';
import { getStandardFiscalYears } from '../../utils/fiscalYears';
import { showConfirm } from '../../utils/modalAlert';
import { UserActionDropdown } from '../../components/Dashboard/UserActionDropdown';
import { MonitoringAuthorizeViewersPanel } from '../../components/Dashboard/MonitoringAuthorizeViewersPanel';
import {
    getPpmpStartOfActivity,
    getPimsReminderInfo
} from '../../components/Dashboard/PimsPublishReminderCard';
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
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
    FileCheck2,
    Layers,
    Tags,
    BookOpen,
    Compass,
    Timer,
    Package,
    HardHat,
    Printer,
    BarChart3,
} from 'lucide-react';
import { AdminReportsView } from '../../components/Dashboard/AdminReportsView';
import { AdminVisualAnalytics } from '../../components/Dashboard/AdminVisualAnalytics';
import { AfkLogoutManagement } from '../../components/Dashboard/AfkLogoutManagement';
import { FundSourcesManagement } from '../../components/Dashboard/FundSourcesManagement';
import { ProcurementModesManagement } from '../../components/Dashboard/ProcurementModesManagement';
import { AccountCodesManagement } from '../../components/Dashboard/AccountCodesManagement';
import { ProgramNamesManagement } from '../../components/Dashboard/ProgramNamesManagement';
import { ProcurementConditionsManagement } from '../../components/Dashboard/ProcurementConditionsManagement';
import { OtherTermsManagement } from '../../components/Dashboard/OtherTermsManagement';
import { SupportingDocumentsManagement } from '../../components/Dashboard/SupportingDocumentsManagement';
import { SignatoriesManagement } from '../../components/Dashboard/SignatoriesManagement';
import { CreateUserModal } from '../../components/Dashboard/CreateUserModal';
import { UserSignatureModal } from '../../components/Dashboard/UserSignatureModal';
import { UserSystemAccessModal } from '../../components/Dashboard/UserSystemAccessModal';
import { UserAccountCodesModal } from '../../components/Dashboard/UserAccountCodesModal';
import { UserRolesModal, getUserRolesList } from '../../components/Dashboard/UserRolesModal';
import { ExpandableText, ExpandableFundBadge } from '../../components/UI/ExpandableCell';

export const AdminDashboard = ({ data, user, onSelectPpmp, onNavigate, onReload }) => {

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

    const [usersList, setUsersList] = useState(data?.users || []);
    const [userSearch, setUserSearch] = useState('');
    const [userSubFilter, setUserSubFilter] = useState('all');
    const [userPage, setUserPage] = useState(1);
    const [userPerPage, setUserPerPage] = useState(10);
    const [processingUserId, setProcessingUserId] = useState(null);
    const [userFeedback, setUserFeedback] = useState({ type: '', text: '' });

    const [passwordModalUser, setPasswordModalUser] = useState(null);
    const [systemAccessModalUser, setSystemAccessModalUser] = useState(null);
    const [twgAccountCodesModalUser, setTwgAccountCodesModalUser] = useState(null);
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

    const [amendmentsList, setAmendmentsList] = useState(data?.pending_amendments || []);
    const [loadingAmendments, setLoadingAmendments] = useState(false);
    const [amendmentFilter, setAmendmentFilter] = useState('PENDING_APPROVAL');
    const [amendmentTypeFilter, setAmendmentTypeFilter] = useState('ALL');
    const [amendmentSearch, setAmendmentSearch] = useState('');
    const [amendmentPage, setAmendmentPage] = useState(1);
    const [amendmentPerPage, setAmendmentPerPage] = useState(10);

    const [rejectAmendmentPpmp, setRejectAmendmentPpmp] = useState(null);
    const [rejectAmendmentRemarks, setRejectAmendmentRemarks] = useState('');
    const [rejectingAmendment, setRejectingAmendment] = useState(false);

    const [approvingAmendmentUuid, setApprovingAmendmentUuid] = useState(null);
    const [receivingUuid, setReceivingUuid] = useState(null);
    const [amendmentFeedback, setAmendmentFeedback] = useState({ type: '', text: '' });

    const [ppmpsList, setPpmpsList] = useState(data?.recent_ppmps || []);
    const [loadingPpmps, setLoadingPpmps] = useState(false);
    const [ppmpSearch, setPpmpSearch] = useState('');
    const [ppmpStatusFilter, setPpmpStatusFilter] = useState('ALL');
    const [ppmpOfficeFilter, setPpmpOfficeFilter] = useState('ALL');
    const [ppmpYearFilter, setPpmpYearFilter] = useState('ALL');
    const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
    const [ppmpCategoryTab, setPpmpCategoryTab] = useState('goods_consulting');
    const [ppmpPage, setPpmpPage] = useState(1);
    const [ppmpPerPage, setPpmpPerPage] = useState(5);
    const [ppmpInfraPage, setPpmpInfraPage] = useState(1);
    const [ppmpInfraPerPage, setPpmpInfraPerPage] = useState(5);
    const [ppmpPagination, setPpmpPagination] = useState(null);

    const adminPpmpYearOptions = useMemo(() => {
        return getStandardFiscalYears([
            ppmpYearFilter !== 'ALL' ? ppmpYearFilter : '',
            ...ppmpsList.map((p) => p.fiscal_year),
            ...availableFiscalYears,
        ]);
    }, [ppmpsList, availableFiscalYears, ppmpYearFilter]);

    const officesList = data?.offices || [];
    const metrics = data?.metrics || {};

    useEffect(() => {
        if (data?.users) {
            setUsersList(data.users);
        }
    }, [data?.users]);

    const fetchAmendments = async () => {
        setLoadingAmendments(true);
        try {
            const params = { per_page: 100 };
            if (amendmentFilter !== 'ALL') {
                params.amendment_status = amendmentFilter;
            }
            const res = await ppmpService.getAll(params);
            const items = res.data?.data || res.data || [];

            const filtered = items.filter(p => p.amendment_status || p.parent_id);
            setAmendmentsList(filtered);
        } catch (e) {
            console.error('Failed to load amendments', e);
        } finally {
            setLoadingAmendments(false);
        }
    };

    const fetchPpmps = async () => {
        setLoadingPpmps(true);
        try {
            const params = {
                page: 1,
                per_page: 100,
            };
            if (ppmpSearch) params.search = ppmpSearch;
            if (ppmpStatusFilter !== 'ALL') params.status = ppmpStatusFilter;
            if (ppmpOfficeFilter !== 'ALL') params.office_id = ppmpOfficeFilter;
            if (ppmpYearFilter !== 'ALL') params.fiscal_year = ppmpYearFilter;

            const res = await ppmpService.getAll(params);
            if (res.data?.available_fiscal_years) {
                setAvailableFiscalYears(res.data.available_fiscal_years);
            }
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
    }, [activeTab, ppmpPage, ppmpPerPage, ppmpStatusFilter, ppmpOfficeFilter, ppmpYearFilter]);

    useEffect(() => {
        if (userFeedback.text) {
            const t = setTimeout(() => setUserFeedback({ type: '', text: '' }), 4000);
            return () => clearTimeout(t);
        }
    }, [userFeedback]);

    useEffect(() => {
        if (amendmentFeedback.text) {
            const t = setTimeout(() => setAmendmentFeedback({ type: '', text: '' }), 4000);
            return () => clearTimeout(t);
        }
    }, [amendmentFeedback]);

    const handleApproveUser = async (targetUser) => {
        const confirmed = await showConfirm({
            title: 'Approve User Registration',
            message: `Approve registration for ${targetUser.name}? The account will be granted system access.`,
            confirmText: 'Yes, Approve User',
            type: 'success',
        });
        if (!confirmed) return;
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
        const confirmed = await showConfirm({
            title: 'Delete User Account',
            message: `Permanently delete account for "${targetUser.name}"? This action cannot be undone.`,
            confirmText: 'Yes, Delete Account',
            type: 'danger',
        });
        if (!confirmed) return;
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
        const confirmed = await showConfirm({
            title: 'Approve Amendment Request',
            message: `Approve amendment request for PPMP No. ${ppmp.ppmp_number || ppmp.title}? A revised draft PPMP will be initialized.`,
            confirmText: 'Yes, Approve Amendment',
            type: 'success',
        });
        if (!confirmed) return;
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

    const pendingUsersCount = usersList.filter(u => !u.is_active && u.approval_status !== 'rejected').length;
    const activeUsersCount = usersList.filter(u => u.is_active && u.approval_status !== 'rejected').length;
    const rejectedUsersCount = usersList.filter(u => u.approval_status === 'rejected').length;
    const pendingAmendmentsCount = metrics.pending_amendments || amendmentsList.filter(a => a.amendment_status === 'PENDING_APPROVAL').length;

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

        return [...list].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeB !== timeA) return timeB - timeA;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
    }, [usersList, userSubFilter, userSearch]);

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

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

                <div
                    onClick={() => setActiveTab('security')}
                    className={`bg-white p-5 rounded-xl border transition shadow-xs cursor-pointer hover:border-emerald-400 ${activeTab === 'security' || activeTab === 'settings' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security &amp; Audit</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">Active</span>
                        <span className="text-xs text-slate-500">protection</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-700 font-semibold">Security Center</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Shield
                        </span>
                    </div>
                </div>
            </div>

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
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'security' || activeTab === 'settings'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Security &amp; Controls</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('afk')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'afk' || activeTab === 'afk_management'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Timer className="w-4 h-4" />
                    <span>AFK Auto-Logout</span>
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
                    onClick={() => setActiveTab('analytics')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'analytics'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Visual Analytics
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeTab === 'analytics' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                        Live
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'reports'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Printer className="w-4 h-4" />
                    <span>Reports &amp; Bulk Print/PDF</span>
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
                    onClick={() => setActiveTab('procurement_modes')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'procurement_modes'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Tags className="w-4 h-4" />
                    <span>Modes of Procurement</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('account_codes')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'account_codes'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Account Codes</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('program_names')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'program_names'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Compass className="w-4 h-4" />
                    <span>Program Names</span>
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
                    onClick={() => setActiveTab('supporting_docs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'supporting_docs'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <FileCheck2 className="w-4 h-4" />
                    <span>Supporting Documents</span>
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

                <button
                    type="button"
                    onClick={() => setActiveTab('monitoring_viewers')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeTab === 'monitoring_viewers'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                    <Eye className="w-4 h-4" />
                    <span>Authorize Viewer (Monitoring)</span>
                </button>
            </div>

            {activeTab === 'users' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">

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

                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">

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

                    <div className="overflow-x-auto border-t border-slate-100 min-h-[300px]">
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

                                        return paginated.map((u, index) => {
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
                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                            {getUserRolesList(u).map((roleKey) => (
                                                                <React.Fragment key={roleKey}>
                                                                    {getRoleBadge(roleKey)}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        {u.designation && (
                                                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                                                                {u.designation}
                                                            </div>
                                                        )}

                                                        {getUserRolesList(u).includes('twg') && (() => {
                                                            const codes = u.account_codes || u.accountCodes || [];
                                                            return (
                                                                <div className="mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setTwgAccountCodesModalUser(u)}
                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer hover:shadow-2xs ${
                                                                            codes.length > 0
                                                                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                                                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                                                                        }`}
                                                                        title={codes.length > 0
                                                                            ? codes.map(ac => `${ac.code} - ${ac.name}`).join('\n')
                                                                            : 'Click to assign account codes'}
                                                                    >
                                                                        <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                                                                        <span>{codes.length} assigned code{codes.length === 1 ? '' : 's'}</span>
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}

                                                        {(() => {
                                                            let systems = [];
                                                            if (Array.isArray(u.accessible_systems)) {
                                                                systems = u.accessible_systems;
                                                            } else if (typeof u.accessible_systems === 'string') {
                                                                try {
                                                                    systems = JSON.parse(u.accessible_systems);
                                                                } catch (_) {
                                                                    systems = [];
                                                                }
                                                            }
                                                            if (!systems || systems.length === 0) return null;
                                                            return (
                                                                <div className="flex flex-wrap gap-1 mt-1.5 max-w-[160px]">
                                                                    {systems.map((sys) => {
                                                                        let label = 'System';
                                                                        let color = 'bg-slate-100 text-slate-700 border-slate-200';
                                                                        if (sys === '/eprocrementppmpapp' || sys === '/eprocurementppmpapp') {
                                                                            label = 'PPMP/APP';
                                                                            color = 'bg-blue-50 text-blue-700 border-blue-200';
                                                                        } else if (sys === '/monitoringsystem' || sys.startsWith('/monitoring')) {
                                                                            label = 'Monitoring';
                                                                            color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                                                        } else if (sys === '/pims' || sys.startsWith('/pims')) {
                                                                            label = 'PIMS';
                                                                            color = 'bg-purple-50 text-purple-700 border-purple-200';
                                                                        } else if (sys === '/supplierevaluation' || sys.startsWith('/supplier-evaluation')) {
                                                                            label = 'Supplier Eval';
                                                                            color = 'bg-amber-50 text-amber-800 border-amber-200';
                                                                        }
                                                                        return (
                                                                            <span
                                                                                key={sys}
                                                                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border tracking-tight ${color}`}
                                                                            >
                                                                                {label}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
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
                                                                <span>
                                                                    {u.signature_path
                                                                        ? u.pnpki_signature?.signature_type === 'pnpki'
                                                                            ? 'PNPKI E-Sig'
                                                                            : 'Signature'
                                                                        : 'No Signature (Add)'}
                                                                </span>
                                                            </button>
                                                            {u.pnpki_signature?.signature_type === 'pnpki' && (
                                                                <>
                                                                    {u.pnpki_signature?.expiration_date && (
                                                                        <span
                                                                            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                                                                u.pnpki_signature?.is_expired
                                                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            }`}
                                                                            title={`PNPKI Expiration Date: ${u.pnpki_signature.expiration_date}`}
                                                                        >
                                                                            {u.pnpki_signature?.is_expired
                                                                                ? `Expired (${u.pnpki_signature.expiration_date})`
                                                                                : `Exp: ${u.pnpki_signature.expiration_date}`}
                                                                        </span>
                                                                    )}
                                                                    {u.pnpki_signature?.proof_pdf_url && (
                                                                        <a
                                                                            href={u.pnpki_signature.proof_pdf_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-2 hover:bg-emerald-50 px-1 py-0.5 rounded transition"
                                                                            title="View PNPKI Proof of Registration PDF"
                                                                        >
                                                                            <FileText className="w-3 h-3 text-emerald-600" />
                                                                            <span>PNPKI PDF</span>
                                                                        </a>
                                                                    )}
                                                                </>
                                                            )}
                                                            {u.authorization_letter_path && (
                                                                <a
                                                                    href={`/api/users/${encodeURIComponent(u.encrypted_id)}/authorization-letter`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        userService.openSecureUserFile(u.encrypted_id, 'authorization-letter');
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 font-medium underline underline-offset-2 hover:bg-teal-50 px-1 py-0.5 rounded transition cursor-pointer"
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
                                                        <UserActionDropdown
                                                            user={u}
                                                            currentUser={user}
                                                            isPending={isPending}
                                                            isRejected={isRejected}
                                                            onToggleStatus={() => handleToggleStatus(u)}
                                                            onChangeRole={() => {
                                                                setRoleModalUser(u);
                                                                setSelectedRole(u.role);
                                                                setRoleError('');
                                                            }}
                                                            onResetPassword={() => {
                                                                setPasswordModalUser(u);
                                                                setNewPassword('');
                                                                setConfirmPassword('');
                                                                setPasswordError('');
                                                            }}
                                                            onManageCodes={() => setTwgAccountCodesModalUser(u)}
                                                            onManageSystems={() => setSystemAccessModalUser(u)}
                                                            onManageSignature={() => setSignaturePreviewUser(u)}
                                                            onApprove={() => handleApproveUser(u)}
                                                            onReject={() => {
                                                                setRejectModalUser(u);
                                                                setRejectionReason('');
                                                            }}
                                                            onDelete={() => handleDeleteUser(u)}
                                                            isProcessing={processingUserId === u.id}
                                                            openUpward={index >= paginated.length - 2 && paginated.length > 2}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

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

                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">

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
                                            const suppInfo = getSupplementalKindInfo(ppmp);

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
                                                            FY {ppmp.fiscal_year} • {ppmp.source_of_fund || 'General Fund'} • {formatCurrency(ppmp.total_budget || 0)}
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
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                    type === 'SUPPLEMENTAL' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'
                                                                }`}>
                                                                    {type === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'}
                                                                </span>
                                                                {type === 'SUPPLEMENTAL' && (
                                                                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                                                        suppInfo.purpose === 'OTHER'
                                                                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                    }`}>
                                                                        {suppInfo.purpose === 'OTHER' ? 'Other' : 'Continuation'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {type === 'SUPPLEMENTAL' && suppInfo.purpose === 'OTHER' && suppInfo.specify && (
                                                                <span className="text-[10px] text-slate-600 italic font-medium leading-tight max-w-[220px]" title={suppInfo.specify}>
                                                                    Specify: <strong>{suppInfo.specify}</strong>
                                                                </span>
                                                            )}
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

            {activeTab === 'logs' && (
                <div className="space-y-4">
                    <AdminActivityLog />
                </div>
            )}

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

                    <div className="px-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap flex-1">

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

                            <select
                                value={ppmpYearFilter}
                                onChange={(e) => { setPpmpYearFilter(e.target.value); setPpmpPage(1); }}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="ALL">All Fiscal Years</option>
                                {adminPpmpYearOptions.map((year) => (
                                    <option key={year} value={year}>CY {year}</option>
                                ))}
                            </select>

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

                    {(() => {
                        const goodsList = ppmpsList.filter((p) => !isInfrastructurePpmp(p));
                        const infraList = ppmpsList.filter((p) => isInfrastructurePpmp(p));
                        const isInfraTab = ppmpCategoryTab === 'infrastructure';
                        const activeItems = isInfraTab ? infraList : goodsList;
                        const activeCurrentPage = isInfraTab ? ppmpInfraPage : ppmpPage;
                        const activeOnPageChange = isInfraTab ? setPpmpInfraPage : setPpmpPage;
                        const activePerPage = isInfraTab ? ppmpInfraPerPage : ppmpPerPage;
                        const activeOnPerPageChange = isInfraTab ? setPpmpInfraPerPage : setPpmpPerPage;
                        const activeEmptyLabel = isInfraTab ? 'Infrastructure PPMPs' : 'Goods & Consulting Services PPMPs';

                        const totalItems = activeItems.length;
                        const totalPages = Math.ceil(totalItems / activePerPage) || 1;
                        const safePage = Math.min(activeCurrentPage, totalPages);
                        const startIndex = (safePage - 1) * activePerPage;
                        const endIndex = Math.min(safePage * activePerPage, totalItems);
                        const paginated = activeItems.slice(startIndex, startIndex + activePerPage);

                        return (
                            <div className="border-t border-slate-200">
                                <div className="px-5 pt-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setPpmpCategoryTab('goods_consulting')}
                                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide border-b-2 transition cursor-pointer ${
                                                ppmpCategoryTab === 'goods_consulting'
                                                    ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <Package className="w-3.5 h-3.5" />
                                            Goods &amp; Consulting Services PPMPs
                                            <span
                                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                                    ppmpCategoryTab === 'goods_consulting'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-slate-200 text-slate-600'
                                                }`}
                                            >
                                                {goodsList.length}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPpmpCategoryTab('infrastructure')}
                                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide border-b-2 transition cursor-pointer ${
                                                ppmpCategoryTab === 'infrastructure'
                                                    ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg shadow-2xs'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            <HardHat className="w-3.5 h-3.5" />
                                            Infrastructure PPMPs
                                            <span
                                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                                    ppmpCategoryTab === 'infrastructure'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-slate-200 text-slate-600'
                                                }`}
                                            >
                                                {infraList.length}
                                            </span>
                                        </button>
                                    </div>

                                    <span className="text-[11px] text-slate-400 italic pb-1.5">
                                        {isInfraTab
                                            ? 'Civil works, construction, rehabilitation, improvement, and infrastructure projects'
                                            : 'Supplies, materials, equipment, general support services, and consulting services'}
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="p-3">Tracking &amp; PPMP No.</th>
                                                <th className="p-3">Office</th>
                                                <th className="p-3">Project Title</th>
                                                <th className="p-3">Fiscal Year</th>
                                                <th className="p-3">Source of Funds</th>
                                                <th className="p-3">Estimated Budget</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loadingPpmps ? (
                                                <tr>
                                                    <td colSpan={8} className="p-8 text-center text-slate-500">
                                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                                                        <span>Loading PPMP records...</span>
                                                    </td>
                                                </tr>
                                            ) : paginated.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                                        No {activeEmptyLabel} found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginated.map((ppmp) => {
                                                    const suppInfo = getSupplementalKindInfo(ppmp);
                                                    const projectTypeLabel = getPpmpProjectTypeLabel(ppmp);
                                                    const isInfra = projectTypeLabel === 'Infrastructure';
                                                    return (
                                                        <tr key={ppmp.id} className="hover:bg-slate-50/80 transition">
                                                            <td className="p-3 font-medium">
                                                                <div className="font-bold text-slate-900">{ppmp.ppmp_number || 'Pending No.'}</div>
                                                                <div className="text-[11px] font-mono text-blue-700 font-semibold">{ppmp.tracking_number}</div>
                                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                    {!ppmp.parent_id ? (
                                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border bg-blue-100 text-blue-800 border-blue-300">
                                                                            Annual
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border ${
                                                                            ppmp.amendment_type === 'AMENDMENT'
                                                                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                                        }`} title={suppInfo.specify ? `Purpose: ${suppInfo.specify}` : ''}>
                                                                            {ppmp.amendment_type === 'AMENDMENT'
                                                                                ? 'Amended'
                                                                                : `Supplemental (${suppInfo.label || 'Continuation'})`}
                                                                        </span>
                                                                    )}
                                                                    <span
                                                                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-tight uppercase border ${
                                                                            isInfra
                                                                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                                                        }`}
                                                                    >
                                                                        {projectTypeLabel}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <ExpandableText text={ppmp.office?.name || '—'} maxLength={35} textClassName="font-medium text-slate-800" />
                                                                {ppmp.office?.code && (
                                                                    <span className="font-mono text-[10px] text-slate-500 font-bold">{ppmp.office.code}</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 max-w-sm">
                                                                <ExpandableText text={ppmp.title} maxLength={50} textClassName="font-semibold text-slate-900" />
                                                                {(() => {
                                                                    const schedule = getPpmpStartOfActivity(ppmp);
                                                                    if (!schedule) return null;
                                                                    const rem = getPimsReminderInfo(schedule);
                                                                    if (!rem) return null;
                                                                    return (
                                                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                                            <span
                                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                                    rem.isUrgent
                                                                                        ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                                                                        : 'bg-amber-50 text-amber-900 border border-amber-200'
                                                                                }`}
                                                                                title={rem.message}
                                                                            >
                                                                                {rem.isUrgent ? <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> : <Clock className="w-2.5 h-2.5 text-amber-600" />}
                                                                                PIMS: Start {schedule.summaryLabel} {rem.isNearEnd && '(Near End of Month)'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })()}
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
                                                            <td className="p-3 text-slate-700">
                                                                <ExpandableFundBadge fund={ppmp.source_of_fund || ppmp.items?.find(i => i.source_of_fund)?.source_of_fund || 'General Fund'} />
                                                            </td>
                                                            <td className="p-3 font-bold text-slate-900">
                                                                {formatCurrency(ppmp.total_budget || 0)}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <StatusBadge status={ppmp.status} />
                                                                    {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse" title={suppInfo.specify ? `Specify: ${suppInfo.specify}` : ''}>
                                                                            Pending {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL'
                                                                                ? `Supplemental (${suppInfo.purpose === 'OTHER' ? (suppInfo.specify ? `Other: ${suppInfo.specify}` : 'Other') : 'Continuation'})`
                                                                                : 'Amendment'}
                                                                        </span>
                                                                    )}
                                                                </div>
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
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {!loadingPpmps && totalItems > 0 && (
                                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                        <PaginationControl
                                            currentPage={safePage}
                                            totalPages={totalPages}
                                            onPageChange={activeOnPageChange}
                                            perPage={activePerPage}
                                            onPerPageChange={(val) => {
                                                activeOnPerPageChange(val);
                                                activeOnPageChange(1);
                                            }}
                                            totalEntries={totalItems}
                                            startIndex={startIndex}
                                            endIndex={endIndex}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {activeTab === 'fund_sources' && (
                <FundSourcesManagement user={user} />
            )}

            {activeTab === 'procurement_modes' && (
                <ProcurementModesManagement />
            )}

            {activeTab === 'account_codes' && (
                <AccountCodesManagement />
            )}

            {activeTab === 'program_names' && (
                <ProgramNamesManagement />
            )}

            {activeTab === 'conditions' && (
                <ProcurementConditionsManagement />
            )}

            {activeTab === 'other_terms' && (
                <OtherTermsManagement />
            )}

            {activeTab === 'supporting_docs' && (
                <SupportingDocumentsManagement />
            )}

            {activeTab === 'signatories' && (
                <SignatoriesManagement initialSignatories={data?.signatories} onReload={onReload} />
            )}

            {(activeTab === 'security' || activeTab === 'settings') && (
                <UnifiedSecurityControls />
            )}

            {(activeTab === 'afk' || activeTab === 'afk_management') && (
                <AfkLogoutManagement />
            )}

            {activeTab === 'analytics' && (
                <AdminVisualAnalytics
                    analytics={data?.analytics}
                    endUserAnalytics={data?.end_user_analytics}
                    metrics={data?.metrics}
                    recentPpmps={ppmpsList.length > 0 ? ppmpsList : (data?.recent_ppmps || [])}
                    onSelectPpmp={onSelectPpmp}
                />
            )}

            {activeTab === 'reports' && (
                <AdminReportsView
                    recentPpmps={ppmpsList.length > 0 ? ppmpsList : (data?.recent_ppmps || [])}
                    offices={data?.offices || []}
                    onSelectPpmp={onSelectPpmp}
                    user={user}
                    data={data}
                />
            )}

            {activeTab === 'monitoring_viewers' && (
                <MonitoringAuthorizeViewersPanel />
            )}

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

            <UserRolesModal
                user={roleModalUser}
                currentUserRole={user?.role}
                onClose={() => setRoleModalUser(null)}
                onSaved={(updatedUser, msg) => {
                    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                    setActionBanner({ type: 'success', text: msg || 'User roles updated successfully.' });
                    setTimeout(() => setActionBanner(null), 4000);
                }}
            />

            <UserSignatureModal
                user={signaturePreviewUser}
                isOpen={Boolean(signaturePreviewUser)}
                onClose={() => setSignaturePreviewUser(null)}
                currentUserRole={user?.role}
                onUpdated={(updatedUser) => {
                    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                    setSignaturePreviewUser(null);
                    setUserFeedback({ type: 'success', text: `Signature for ${updatedUser.name} updated successfully.` });
                }}
            />

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

            <UserSystemAccessModal
                isOpen={!!systemAccessModalUser}
                onClose={() => setSystemAccessModalUser(null)}
                targetUser={systemAccessModalUser}
                onSuccess={(updatedUser) => {
                    setUsersList(prev =>
                        prev.map(item => (item.id === updatedUser.id ? { ...item, ...updatedUser } : item))
                    );
                    setUserFeedback({
                        type: 'success',
                        text: `System access permissions for "${updatedUser.name}" have been updated successfully.`,
                    });
                    setTimeout(() => setUserFeedback({ type: '', text: '' }), 4000);
                }}
            />

            <UserAccountCodesModal
                isOpen={!!twgAccountCodesModalUser}
                onClose={() => setTwgAccountCodesModalUser(null)}
                targetUser={twgAccountCodesModalUser}
                onSuccess={(updatedUser) => {
                    setUsersList(prev =>
                        prev.map(item => (item.id === updatedUser.id ? { ...item, ...updatedUser } : item))
                    );
                    setUserFeedback({
                        type: 'success',
                        text: `Assigned account codes for "${updatedUser.name}" have been updated successfully.`,
                    });
                    setTimeout(() => setUserFeedback({ type: '', text: '' }), 4000);
                    if (onReload) onReload();
                }}
            />

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
