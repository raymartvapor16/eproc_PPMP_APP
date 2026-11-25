import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PaginationControl } from '../../components/UI/PaginationControl';
import { signatoryService, userService, officeService, ppmpService } from '../../services/api';
import { isAwaitingReceive, getSupplementalKindInfo, isInfrastructurePpmp, getPpmpProjectTypeLabel } from '../../utils/workflowHelpers';
import { getStandardFiscalYears } from '../../utils/fiscalYears';
import { showConfirm } from '../../utils/modalAlert';
import { AdminSidebar } from '../../components/Dashboard/AdminSidebar';
import { AdminVisualAnalytics } from '../../components/Dashboard/AdminVisualAnalytics';
import { AdminReportsView } from '../../components/Dashboard/AdminReportsView';
import { AdminActivityLog } from '../../components/Dashboard/AdminActivityLog';
import { SuperAdminSecurityLogsView } from '../../components/Dashboard/SuperAdminSecurityLogsView';
import { FundSourcesManagement } from '../../components/Dashboard/FundSourcesManagement';
import { ProcurementModesManagement } from '../../components/Dashboard/ProcurementModesManagement';
import { ProcurementConditionsManagement } from '../../components/Dashboard/ProcurementConditionsManagement';
import { OtherTermsManagement } from '../../components/Dashboard/OtherTermsManagement';
import { SupportingDocumentsManagement } from '../../components/Dashboard/SupportingDocumentsManagement';
import { SystemSettingsManagement } from '../../components/Dashboard/SystemSettingsManagement';
import { AfkLogoutManagement } from '../../components/Dashboard/AfkLogoutManagement';
import { DatabaseBackupManagement } from '../../components/Dashboard/DatabaseBackupManagement';
import { SignatoriesManagement } from '../../components/Dashboard/SignatoriesManagement';
import { PortalSystemsManagement } from '../../components/Dashboard/PortalSystemsManagement';
import { OppmoTeamManagement } from '../../components/Dashboard/OppmoTeamManagement';
import { isDeveloperModeActive } from '../../utils/devToolsGuard';
import { AdminDashboard } from './AdminDashboard';
import { MonitoringAuthorizeViewersPanel } from '../../components/Dashboard/MonitoringAuthorizeViewersPanel';
import { EndUserVisualAnalytics } from '../../components/Dashboard/EndUserVisualAnalytics';
import { CreateUserModal } from '../../components/Dashboard/CreateUserModal';
import { UserSignatureModal } from '../../components/Dashboard/UserSignatureModal';
import { UserSystemAccessModal } from '../../components/Dashboard/UserSystemAccessModal';
import { UserActionDropdown } from '../../components/Dashboard/UserActionDropdown';
import { UserRolesModal, getUserRolesList } from '../../components/Dashboard/UserRolesModal';
import { canUserAccessSystem } from '../../components/UI/UnauthorizedSystemAccessView';
import { ExpandableText, ExpandableFundBadge } from '../../components/UI/ExpandableCell';
import {
    PimsPublishReminderCard,
    getPpmpStartOfActivity,
    getPimsReminderInfo
} from '../../components/Dashboard/PimsPublishReminderCard';
import {
    FileText,
    Clock,
    CheckCircle2,
    RotateCcw,
    Printer,
    ArrowRight,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Shield,
    Plus,
    Trash2,
    X,
    Save,
    Users,
    Key,
    Lock,
    Search,
    Upload,
    FileSpreadsheet,
    Download,
    Building2,
    Check,
    UserCheck,
    UserX,
    ToggleLeft,
    ToggleRight,
    Phone,
    MapPin,
    Inbox,
    Loader2,
    RefreshCw,
    Eye,
    Image as ImageIcon,
    PenTool,
    UserPlus,
    Layers,
    Landmark,
    Package,
    HardHat,
} from 'lucide-react';

export const Dashboard = ({ data, user, onSelectPpmp, onNavigate, onReload }) => {
    const metrics = data?.metrics || {};
    const recentPpmps = data?.recent_ppmps || [];
    const analytics = data?.analytics || null;

    const [adminSection, setAdminSection] = useState('overview');

    const [reviewerView, setReviewerView] = useState('queue');

    const [devModeActive, setDevModeActive] = useState(() => isDeveloperModeActive());
    useEffect(() => {
        const handleDevModeChange = (e) => {
            if (e.detail && typeof e.detail.developer_mode !== 'undefined') {
                setDevModeActive(Boolean(e.detail.developer_mode));
            }
        };
        const handleAdminNav = (e) => {
            if (e.detail?.section) {
                setAdminSection(e.detail.section);
            }
        };
        const handleDataReload = () => {
            if (onReload) onReload();
        };

        window.addEventListener('developer_mode:changed', handleDevModeChange);
        window.addEventListener('admin:navigate_section', handleAdminNav);
        window.addEventListener('app:data_reload', handleDataReload);
        window.addEventListener('pims:published', handleDataReload);
        window.addEventListener('monitoring:updated', handleDataReload);

        return () => {
            window.removeEventListener('developer_mode:changed', handleDevModeChange);
            window.removeEventListener('admin:navigate_section', handleAdminNav);
            window.removeEventListener('app:data_reload', handleDataReload);
            window.removeEventListener('pims:published', handleDataReload);
            window.removeEventListener('monitoring:updated', handleDataReload);
        };
    }, [onReload]);

    const [signatoriesList, setSignatoriesList] = useState(data?.signatories || []);
    const [isSignatoryModalOpen, setIsSignatoryModalOpen] = useState(false);
    const [editingSignatory, setEditingSignatory] = useState(null);
    const [signatoryForm, setSignatoryForm] = useState({
        signatory_type: 'budget_requirement',
        name: '',
        position: '',
        is_active: true,
    });
    const [savingSignatory, setSavingSignatory] = useState(false);
    const [signatoryError, setSignatoryError] = useState('');
    const [signatoryPage, setSignatoryPage] = useState(1);
    const [signatoryPerPage, setSignatoryPerPage] = useState(5);

    const [usersList, setUsersList] = useState(data?.users || []);
    const [userSearch, setUserSearch] = useState('');
    const [userTab, setUserTab] = useState('all');
    const [userPage, setUserPage] = useState(1);
    const [userPerPage, setUserPerPage] = useState(5);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [processingUserId, setProcessingUserId] = useState(null);
    const [userActionFeedback, setUserActionFeedback] = useState({ type: '', text: '' });
    const [signaturePreviewUser, setSignaturePreviewUser] = useState(null);
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [selectedUserForSystems, setSelectedUserForSystems] = useState(null);
    const [roleModalUser, setRoleModalUser] = useState(null);

    const [officesList, setOfficesList] = useState(data?.offices || []);
    const [officeSearch, setOfficeSearch] = useState('');
    const [officePage, setOfficePage] = useState(1);
    const [officePerPage, setOfficePerPage] = useState(5);
    const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
    const [editingOffice, setEditingOffice] = useState(null);
    const [officeForm, setOfficeForm] = useState({
        abbreviation: '',
        office_name: '',
        head_name: '',
        designation: '',
        responsibility_number: '',
    });
    const [savingOffice, setSavingOffice] = useState(false);
    const [officeError, setOfficeError] = useState('');

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importFileName, setImportFileName] = useState('');
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    const [receivingUuids, setReceivingUuids] = useState({});
    const [openingUuids, setOpeningUuids] = useState({});

    const handleOpenDetails = async (uuid) => {
        if (!onSelectPpmp) return;
        setOpeningUuids(prev => ({ ...prev, [uuid]: true }));
        try {
            await onSelectPpmp(uuid);
        } finally {
            setOpeningUuids(prev => ({ ...prev, [uuid]: false }));
        }
    };

    const defaultPpmpTab = user?.role === 'twg' ? 'TWG_REVIEW' : 'all';
    const [ppmpTab, setPpmpTab] = useState(defaultPpmpTab);

    useEffect(() => {
        setPpmpTab(user?.role === 'twg' ? 'TWG_REVIEW' : 'all');
    }, [user?.role]);
    const [inReviewSubFilter, setInReviewSubFilter] = useState('');
    const [returnedSubFilter, setReturnedSubFilter] = useState('');
    const [ppmpSearch, setPpmpSearch] = useState('');
    const [ppmpYearFilter, setPpmpYearFilter] = useState('');
    const [ppmpCategoryTab, setPpmpCategoryTab] = useState('goods_consulting');
    const [ppmpPage, setPpmpPage] = useState(1);
    const [ppmpPerPage, setPpmpPerPage] = useState(5);
    const [ppmpInfraPage, setPpmpInfraPage] = useState(1);
    const [ppmpInfraPerPage, setPpmpInfraPerPage] = useState(5);

    const isSuspendedStatus = (status) => {
        if (!status) return false;
        const s = String(status).toUpperCase();
        return ['HEAD_RETURNED', 'BUDGET_OFFICER_RETURNED', 'PACCO_RETURNED', 'OPPMO_RETURNED', 'TWG_RETURNED'].includes(s) || s.endsWith('_RETURNED');
    };

    const isInReviewStatus = (status) => {
        if (!status) return false;
        const s = String(status).toUpperCase();
        return ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'].includes(s);
    };

    const ppmpYearOptions = useMemo(() => {
        return getStandardFiscalYears([ppmpYearFilter, ...recentPpmps.map(p => p.fiscal_year)]);
    }, [recentPpmps, ppmpYearFilter]);

    const categoryScopedPpmps = useMemo(() => {
        const isInfra = ppmpCategoryTab === 'infrastructure';
        return recentPpmps.filter((p) => (isInfra ? isInfrastructurePpmp(p) : !isInfrastructurePpmp(p)));
    }, [recentPpmps, ppmpCategoryTab]);

    const statusCounts = useMemo(() => ({
        all: categoryScopedPpmps.length,
        HEAD_PENDING: categoryScopedPpmps.filter(p => p.status === 'HEAD_PENDING').length,
        HEAD_APPROVED: categoryScopedPpmps.filter(p => p.status === 'HEAD_APPROVED' || p.status === 'READY_FOR_REVIEW').length,
        BUDGET_OFFICER_REVIEW: categoryScopedPpmps.filter(p => p.status === 'BUDGET_OFFICER_REVIEW').length,
        PACCO_REVIEW: categoryScopedPpmps.filter(p => p.status === 'PACCO_REVIEW').length,
        OPPMO_REVIEW: categoryScopedPpmps.filter(p => p.status === 'OPPMO_REVIEW').length,
        TWG_REVIEW: categoryScopedPpmps.filter(p => p.status === 'TWG_REVIEW').length,
        IN_REVIEW: categoryScopedPpmps.filter(p => isInReviewStatus(p.status)).length,
        READY_TO_PRINT: categoryScopedPpmps.filter(p => p.status === 'READY_TO_PRINT').length,
        RETURNED: categoryScopedPpmps.filter(p => isSuspendedStatus(p.status)).length,
        DRAFT: categoryScopedPpmps.filter(p => p.status === 'DRAFT').length,
        PENDING_AMENDMENTS: categoryScopedPpmps.filter(p => p.amendment_status === 'PENDING_APPROVAL').length,
    }), [categoryScopedPpmps]);

    const counts = statusCounts;

    const filteredRecentPpmps = useMemo(() => {
        return recentPpmps.filter((ppmp) => {

            if (ppmpTab !== 'all') {
                if (ppmpTab === 'RETURNED') {
                    if (!isSuspendedStatus(ppmp.status)) return false;
                    if (returnedSubFilter && ppmp.status !== returnedSubFilter) return false;
                } else if (ppmpTab === 'IN_REVIEW') {
                    if (inReviewSubFilter) {
                        if (ppmp.status !== inReviewSubFilter) return false;
                    } else {
                        if (!isInReviewStatus(ppmp.status)) return false;
                    }
                } else if (ppmpTab === 'PENDING_AMENDMENTS') {
                    if (ppmp.amendment_status !== 'PENDING_APPROVAL') return false;
                } else if (ppmpTab === 'ENDORSED_APPROVED') {
                    if (['DRAFT', 'HEAD_PENDING'].includes(ppmp.status) || isSuspendedStatus(ppmp.status)) return false;
                } else if (ppmpTab === 'BUDGET_APPROVED') {
                    if (!['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp.status)) return false;
                } else if (ppmpTab === 'OPPMO_APPROVED') {
                    if (!['TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp.status)) return false;
                } else if (ppmpTab === 'TWG_APPROVED') {
                    const isTwgApproved = Boolean(ppmp.twg_approved_at || ppmp.signatures?.some(s => s.role === 'twg'));
                    const isForwardedStatus = ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp.status);
                    if (!isForwardedStatus || !isTwgApproved) return false;
                } else if (ppmp.status !== ppmpTab) {
                    return false;
                }
            }

            if (ppmpYearFilter && String(ppmp.fiscal_year) !== String(ppmpYearFilter)) {
                return false;
            }

            if (ppmpSearch.trim()) {
                const query = ppmpSearch.trim().toLowerCase();
                const trackingNo = (ppmp.tracking_number || '').toLowerCase();
                const ppmpNo = String(ppmp.ppmp_number || '').toLowerCase();
                const title = (ppmp.title || '').toLowerCase();
                const officeName = (ppmp.office?.office_name || '').toLowerCase();
                const officeAbbr = (ppmp.office?.abbreviation || '').toLowerCase();
                const planType = (ppmp.plan_type || '').toLowerCase();

                const matches = trackingNo.includes(query)
                    || ppmpNo.includes(query)
                    || title.includes(query)
                    || officeName.includes(query)
                    || officeAbbr.includes(query)
                    || planType.includes(query);

                if (!matches) return false;
            }

            return true;
        });
    }, [recentPpmps, ppmpTab, inReviewSubFilter, returnedSubFilter, ppmpYearFilter, ppmpSearch]);

    const handleReceive = async (uuid) => {
        setReceivingUuids(prev => ({ ...prev, [uuid]: true }));
        try {
            await ppmpService.receive(uuid);
            if (onReload) {
                await onReload();
            }
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to mark document as received.');
        } finally {
            setReceivingUuids(prev => ({ ...prev, [uuid]: false }));
        }
    };

    useEffect(() => {
        if (data?.signatories) {
            setSignatoriesList(data.signatories);
        }
        if (data?.users) {
            setUsersList(data.users);
        }
        if (data?.offices) {
            setOfficesList(data.offices);
        }
    }, [data?.signatories, data?.users, data?.offices]);

    const refreshUsers = async () => {
        try {
            const res = await userService.getAll();
            setUsersList(res.data);
        } catch (e) {
            console.error('Failed to load users', e);
        }
    };

    const openPasswordModal = (targetUser) => {
        setSelectedUserForPassword(targetUser);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordSuccess('');
        setIsPasswordModalOpen(true);
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }

        setSavingPassword(true);
        try {
            const res = await userService.changePassword(selectedUserForPassword.id, newPassword);
            setPasswordSuccess(res.data.message || 'Password updated successfully.');
            setTimeout(() => {
                setIsPasswordModalOpen(false);
            }, 1200);
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Failed to update password.');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleApproveUser = async (targetUser) => {
        setProcessingUserId(targetUser.id);
        setUserActionFeedback({ type: '', text: '' });
        try {
            const res = await userService.approve(targetUser.id);
            setUserActionFeedback({ type: 'success', text: res.data.message || `Account for ${targetUser.name} approved.` });
            await refreshUsers();
        } catch (err) {
            setUserActionFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to approve account.' });
        } finally {
            setProcessingUserId(null);
        }
    };

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedUserForReject, setSelectedUserForReject] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingUser, setRejectingUser] = useState(false);

    const openRejectModal = (targetUser) => {
        setSelectedUserForReject(targetUser);
        setRejectReason('');
        setIsRejectModalOpen(true);
    };

    const closeRejectModal = () => {
        setIsRejectModalOpen(false);
        setSelectedUserForReject(null);
        setRejectReason('');
    };

    const handleConfirmRejectUser = async (e) => {
        e?.preventDefault?.();
        if (!selectedUserForReject) return;

        setRejectingUser(true);
        setProcessingUserId(selectedUserForReject.id);
        setUserActionFeedback({ type: '', text: '' });
        try {
            const res = await userService.reject(selectedUserForReject.id, rejectReason.trim());
            setUserActionFeedback({ type: 'success', text: res.data.message || `Registration for ${selectedUserForReject.name} rejected.` });
            closeRejectModal();
            await refreshUsers();
        } catch (err) {
            setUserActionFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to reject registration.' });
        } finally {
            setRejectingUser(false);
            setProcessingUserId(null);
        }
    };

    const handleToggleUserStatus = async (targetUser) => {
        const actionLabel = targetUser.is_active ? 'deactivate' : 'activate';
        const confirmed = await showConfirm({
            title: `${targetUser.is_active ? 'Deactivate' : 'Activate'} User`,
            message: `Are you sure you want to ${actionLabel} ${targetUser.name}?`,
            confirmText: `Yes, ${targetUser.is_active ? 'Deactivate' : 'Activate'}`,
            type: targetUser.is_active ? 'warning' : 'success',
        });
        if (!confirmed) return;

        setProcessingUserId(targetUser.id);
        setUserActionFeedback({ type: '', text: '' });
        try {
            const res = await userService.toggleStatus(targetUser.id);
            setUserActionFeedback({ type: 'success', text: res.data.message || `Status updated for ${targetUser.name}.` });
            await refreshUsers();
        } catch (err) {
            setUserActionFeedback({ type: 'error', text: err.response?.data?.message || `Failed to ${actionLabel} account.` });
        } finally {
            setProcessingUserId(null);
        }
    };

    const handleDeleteUser = async (targetUser) => {
        const confirmed = await showConfirm({
            title: 'Delete User Account',
            message: `Are you sure you want to permanently delete user "${targetUser.name}" (${targetUser.email})? This action cannot be undone.`,
            confirmText: 'Yes, Delete Account',
            type: 'danger',
        });
        if (!confirmed) return;

        setProcessingUserId(targetUser.id);
        setUserActionFeedback({ type: '', text: '' });
        try {
            const res = await userService.delete(targetUser.id);
            setUserActionFeedback({ type: 'success', text: res.data.message || `User deleted successfully.` });
            await refreshUsers();
        } catch (err) {
            setUserActionFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to delete user.' });
        } finally {
            setProcessingUserId(null);
        }
    };

    const refreshSignatories = async () => {
        try {
            const res = await signatoryService.getAll();
            setSignatoriesList(res.data);
        } catch (e) {
            console.error('Failed to load signatories', e);
        }
    };

    const openSignatoryModal = (sig = null) => {
        setEditingSignatory(sig);
        setSignatoryError('');
        if (sig) {
            setSignatoryForm({
                signatory_type: sig.signatory_type,
                name: sig.name,
                position: sig.position,
                is_active: Boolean(sig.is_active),
            });
        } else {
            setSignatoryForm({
                signatory_type: 'budget_requirement',
                name: '',
                position: '',
                is_active: true,
            });
        }
        setIsSignatoryModalOpen(true);
    };

    const handleSaveSignatory = async (e) => {
        e.preventDefault();
        setSignatoryError('');
        setSavingSignatory(true);

        try {
            if (editingSignatory) {
                await signatoryService.update(editingSignatory.id, signatoryForm);
            } else {
                await signatoryService.create(signatoryForm);
            }
            setIsSignatoryModalOpen(false);
            await refreshSignatories();
        } catch (err) {
            setSignatoryError(err.response?.data?.message || 'Failed to save signatory.');
        } finally {
            setSavingSignatory(false);
        }
    };

    const handleDeleteSignatory = async (id) => {
        const confirmed = await showConfirm({
            title: 'Remove Signatory',
            message: 'Are you sure you want to remove this signatory?',
            confirmText: 'Yes, Remove Signatory',
            type: 'danger',
        });
        if (!confirmed) return;
        try {
            await signatoryService.delete(id);
            await refreshSignatories();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete signatory.');
        }
    };

    const refreshOffices = async () => {
        try {
            const res = await officeService.getAll();
            setOfficesList(res.data);
        } catch (e) {
            console.error('Failed to load offices', e);
        }
    };

    const openOfficeModal = (off = null) => {
        setEditingOffice(off);
        setOfficeError('');
        if (off) {
            setOfficeForm({
                abbreviation: off.code || '',
                office_name: off.name || '',
                head_name: off.head_name || '',
                designation: off.designation || '',
                responsibility_number: off.responsibility_number || '',
            });
        } else {
            setOfficeForm({
                abbreviation: '',
                office_name: '',
                head_name: '',
                designation: '',
                responsibility_number: '',
            });
        }
        setIsOfficeModalOpen(true);
    };

    const handleSaveOffice = async (e) => {
        e.preventDefault();
        setOfficeError('');
        setSavingOffice(true);

        try {
            if (editingOffice) {
                await officeService.update(editingOffice.id, officeForm);
            } else {
                await officeService.create(officeForm);
            }
            setIsOfficeModalOpen(false);
            await refreshOffices();
        } catch (err) {
            setOfficeError(err.response?.data?.message || 'Failed to save office.');
        } finally {
            setSavingOffice(false);
        }
    };

    const handleDeleteOffice = async (id) => {
        const confirmed = await showConfirm({
            title: 'Delete Office',
            message: 'Are you sure you want to delete this office record? Linked documents will require re-association.',
            confirmText: 'Yes, Delete Office',
            type: 'danger',
        });
        if (!confirmed) return;
        try {
            await officeService.delete(id);
            await refreshOffices();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete office.');
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFileName(file.name);
        setImportError('');
        setImportSuccess('');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (!data || data.length < 2) {
                    setImportError('File is empty or missing data rows.');
                    return;
                }

                const headers = data[0].map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));
                const abbrIdx = headers.findIndex(h => h.includes('abbreviation') || h === 'code' || h === 'abbr');
                const nameIdx = headers.findIndex(h => h.includes('office') || h === 'name' || h === 'office_name');
                const headIdx = headers.findIndex(h => h.includes('head') || h.includes('head_name'));
                const desigIdx = headers.findIndex(h => h.includes('designation') || h.includes('position'));
                const respIdx = headers.findIndex(h => h.includes('responsibility') || h.includes('resp'));

                if (abbrIdx === -1 || nameIdx === -1) {
                    setImportError('Missing required columns: "abbreviation" and "office_name". Please check your file header.');
                    return;
                }

                const parsedRows = [];
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;
                    const abbr = String(row[abbrIdx] || '').trim();
                    const offName = String(row[nameIdx] || '').trim();
                    if (!abbr || !offName) continue;

                    parsedRows.push({
                        abbreviation: abbr,
                        office_name: offName,
                        head_name: headIdx !== -1 && row[headIdx] ? String(row[headIdx]).trim() : '',
                        designation: desigIdx !== -1 && row[desigIdx] ? String(row[desigIdx]).trim() : '',
                        responsibility_number: respIdx !== -1 && row[respIdx] ? String(row[respIdx]).trim() : '',
                    });
                }

                if (parsedRows.length === 0) {
                    setImportError('No valid office rows found in the file.');
                } else {
                    setImportData(parsedRows);
                }
            } catch (err) {
                console.error(err);
                setImportError('Failed to parse file. Make sure it is a valid CSV or Excel file.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExecuteImport = async () => {
        if (!importData || importData.length === 0) {
            setImportError('No data ready for import.');
            return;
        }

        setImporting(true);
        setImportError('');
        setImportSuccess('');

        try {
            const res = await officeService.importOffices(importData);
            setImportSuccess(res.data.message || 'Offices imported successfully!');
            await refreshOffices();
            setTimeout(() => {
                setIsImportModalOpen(false);
                setImportData([]);
                setImportFileName('');
                setImportSuccess('');
            }, 1500);
        } catch (err) {
            setImportError(err.response?.data?.message || 'Failed to import offices.');
        } finally {
            setImporting(false);
        }
    };

    const downloadSampleCsv = () => {
        const csvContent = "abbreviation,office_name,head_name,designation,responsibility_number\n" +
            "PGO-ICTD,Provincial Governor's Office - Information & Communications Technology Division,Hon. Maria Clara Santos,Department Head / Provincial ICT Officer,1011\n" +
            "PBO,Provincial Budget Office,Atty. Roberto G. Almendras CPA,Provincial Budget Officer,1021\n" +
            "OPPMO,Office of the Provincial Procurement Management Officer,Mr. Christopher B. Ramos,Head BAC Secretariat,1031";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'offices_sample_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const pendingUsersCount = usersList.filter(u => !u.is_active && u.approval_status !== 'rejected').length;
    const activeUsersCount = usersList.filter(u => u.is_active && u.approval_status !== 'rejected').length;
    const rejectedUsersCount = usersList.filter(u => u.approval_status === 'rejected').length;

    if (user?.role === 'admin') {
        return (
            <AdminDashboard
                data={data}
                user={user}
                onSelectPpmp={onSelectPpmp}
                onNavigate={onNavigate}
                onReload={onReload}
            />
        );
    }

    if (user?.role === 'super_admin') {

        const SignatoriesPanel = (
            <SignatoriesManagement
                initialSignatories={data?.signatories}
                onReload={onReload}
            />
        );

        const renderAdminContent = () => {
            if (adminSection === 'analytics') {
                return <AdminVisualAnalytics analytics={analytics} endUserAnalytics={data?.end_user_analytics} metrics={metrics} recentPpmps={recentPpmps} onSelectPpmp={onSelectPpmp} />;
            }
            if (adminSection === 'reports' || adminSection === 'ready_to_print_bulk') {
                return (
                    <AdminReportsView
                        recentPpmps={recentPpmps}
                        offices={officesList}
                        onSelectPpmp={onSelectPpmp}
                        user={user}
                        data={data}
                    />
                );
            }
            if (adminSection === 'signatories') {
                return <div className="space-y-6">{SignatoriesPanel}</div>;
            }
            if (adminSection === 'security_threats') {
                return <SuperAdminSecurityLogsView />;
            }
            if (adminSection === 'logs') {
                return <AdminActivityLog />;
            }
            if (adminSection === 'fund_sources') {
                return <FundSourcesManagement user={user} />;
            }
            if (adminSection === 'procurement_modes') {
                return <ProcurementModesManagement />;
            }
            if (adminSection === 'conditions') {
                return <ProcurementConditionsManagement />;
            }
            if (adminSection === 'other_terms') {
                return <OtherTermsManagement />;
            }
            if (adminSection === 'supporting_docs') {
                return <SupportingDocumentsManagement />;
            }
            if (adminSection === 'portal_systems') {
                return <PortalSystemsManagement />;
            }
            if (adminSection === 'oppmo_team') {
                return <OppmoTeamManagement />;
            }
            if (adminSection === 'settings' || adminSection === 'security') {
                return <SystemSettingsManagement />;
            }
            if (adminSection === 'afk' || adminSection === 'afk_management') {
                return <AfkLogoutManagement />;
            }
            if (adminSection === 'database_backup') {
                return <SuperAdminSecurityLogsView initialTab="manual_backup" />;
            }
            if (adminSection === 'monitoring_viewers') {
                return <MonitoringAuthorizeViewersPanel />;
            }

            return null;
        };

        const adminContent = renderAdminContent();

        return (
            <div className="flex gap-6 items-start">

                <AdminSidebar
                    activeSection={adminSection}
                    onSelectSection={setAdminSection}
                    metrics={metrics}
                    pendingUsersCount={pendingUsersCount}
                />

                <div className="flex-1 min-w-0 space-y-6">

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                                Super Admin Portal — {user?.name}
                            </h1>
                            <p className="text-xs text-slate-500 mt-1">
                                System Executive Administration &amp; Analytics • E-Procurement Management
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setAdminSection('settings')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                    devModeActive
                                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                }`}
                                title="Click to manage Developer Mode / DevTools Security"
                            >
                                <span className={`w-2 h-2 rounded-full ${devModeActive ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                                <span>Dev Mode: {devModeActive ? 'ACTIVE (F12 Allowed)' : 'OFF (Strict Protected)'}</span>
                            </button>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                System Online
                            </span>
                        </div>
                    </div>

                    {adminContent ? (
                        adminContent
                    ) : (
                        <div className="space-y-6">

                            {(adminSection === 'overview') && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 text-blue-700 rounded-lg"><FileText className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-slate-900">{metrics.total_ppmps || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">Total System PPMPs</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-slate-100 text-slate-700 rounded-lg"><Clock className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-slate-800">{metrics.draft || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">Draft Status</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-amber-100 text-amber-700 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-amber-900">{metrics.head_pending || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">Pending Head Approval</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-indigo-900">{metrics.in_review || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">In Active Review</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg"><Printer className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-emerald-900">{metrics.ready_to_print || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">Ready to Print</div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                        <div className="p-3 bg-amber-100 text-amber-700 rounded-lg"><RefreshCw className="w-5 h-5" /></div>
                                        <div>
                                            <div className="text-xl font-black text-amber-900">{metrics.pending_amendments || 0}</div>
                                            <div className="text-xs font-medium text-slate-500">Pending Amendments</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {adminSection === 'overview' && <SystemSettingsManagement />}

                            {adminSection === 'overview' && <AfkLogoutManagement />}

                            {adminSection === 'overview' && SignatoriesPanel}

                            {(adminSection === 'overview' || adminSection === 'users') && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                <Users className="w-4 h-4 text-blue-600" />
                                                User Management &amp; Credentials
                                            </h2>
                                            <span className="text-xs text-slate-500">
                                                Review pending registrations, manage active accounts, modify designations, and reset passwords
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <div className="relative w-full sm:w-64">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    placeholder="Search name, email, office, phone..."
                                                    value={userSearch}
                                                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                                                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                    {userActionFeedback.text && (
                                        <div className={`px-5 py-3 text-xs flex items-center justify-between border-b ${userActionFeedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium' : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'}`}>
                                            <span>{userActionFeedback.text}</span>
                                            <button type="button" onClick={() => setUserActionFeedback({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    {(() => {
                                        const pendingPnpkiUsers = usersList.filter(
                                            (usr) => usr.pnpki_signature?.renewal_status === 'pending' && usr.pnpki_signature?.pending_expiration_date
                                        );
                                        if (pendingPnpkiUsers.length === 0) return null;
                                        return (
                                            <div className="mx-5 mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-start gap-2.5">
                                                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                                                    <div>
                                                        <div className="text-xs font-extrabold text-amber-950">
                                                            {pendingPnpkiUsers.length} PNPKI E-Signature Renewal Request{pendingPnpkiUsers.length > 1 ? 's' : ''} Awaiting Super Admin Approval
                                                        </div>
                                                        <div className="text-[11px] text-amber-800 mt-0.5">
                                                            Review the new expiration date and Proof of Registration PDF before approving.
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {pendingPnpkiUsers.map((usr) => (
                                                        <button
                                                            key={usr.id}
                                                            type="button"
                                                            onClick={() => setSignaturePreviewUser(usr)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition cursor-pointer shadow-2xs"
                                                        >
                                                            <PenTool className="w-3 h-3" />
                                                            <span>Review {usr.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="px-5 pt-3 pb-0 flex items-center gap-2 border-b border-slate-100">
                                        {[
                                            { key: 'all', label: 'All Users' },
                                            { key: 'pending', label: `Pending${pendingUsersCount > 0 ? ` (${pendingUsersCount})` : ''}` },
                                            { key: 'active', label: `Active (${activeUsersCount})` },
                                            { key: 'rejected', label: `Rejected${rejectedUsersCount > 0 ? ` (${rejectedUsersCount})` : ''}` },
                                        ].map(tab => (
                                            <button
                                                key={tab.key}
                                                type="button"
                                                onClick={() => { setUserTab(tab.key); setUserPage(1); }}
                                                className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition ${userTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-3">Name / Contact</th>
                                                    <th className="p-3">Office</th>
                                                    <th className="p-3">Role</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(() => {
                                                    let filtered = usersList;
                                                    if (userTab === 'pending') filtered = filtered.filter(u => !u.is_active && u.approval_status !== 'rejected');
                                                    else if (userTab === 'active') filtered = filtered.filter(u => u.is_active && u.approval_status !== 'rejected');
                                                    else if (userTab === 'rejected') filtered = filtered.filter(u => u.approval_status === 'rejected');
                                                    if (userSearch) {
                                                        const q = userSearch.toLowerCase();
                                                        filtered = filtered.filter(u =>
                                                            u.name?.toLowerCase().includes(q) ||
                                                            u.email?.toLowerCase().includes(q) ||
                                                            u.office?.name?.toLowerCase().includes(q) ||
                                                            u.phone_number?.toLowerCase().includes(q)
                                                        );
                                                    }
                                                    if (filtered.length === 0) return (
                                                        <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">No users match your filter.</td></tr>
                                                    );
                                                    const totalPages = Math.ceil(filtered.length / userPerPage) || 1;
                                                    const safePage = Math.min(userPage, totalPages);
                                                    const paginated = filtered.slice((safePage - 1) * userPerPage, safePage * userPerPage);
                                                    return paginated.map((u, index) => {
                                                        const isPending = !u.is_active && u.approval_status !== 'rejected';
                                                        const isRejected = u.approval_status === 'rejected';
                                                        return (
                                                            <tr key={u.id} className="hover:bg-slate-50 transition">
                                                                <td className="p-3">
                                                                    <div className="font-bold text-slate-900">{u.name}</div>
                                                                    <div className="text-slate-500">{u.email}</div>
                                                                    {u.phone_number && <div className="text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone_number}</div>}
                                                                </td>
                                                                <td className="p-3 text-slate-700">
                                                                    <div className="font-medium">{u.office?.name || '—'}</div>
                                                                    {u.office?.code && <div className="text-slate-400 font-mono">{u.office.code}</div>}
                                                                </td>
                                                                <td className="p-3">
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                            {getUserRolesList(u).map((roleKey) => (
                                                                                <span
                                                                                    key={roleKey}
                                                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                                        roleKey === 'super_admin' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold' :
                                                                                        roleKey === 'admin' ? 'bg-blue-100 text-blue-800 font-bold' :
                                                                                        roleKey === 'budget_officer' ? 'bg-indigo-100 text-indigo-800' :
                                                                                        roleKey === 'oppmo' ? 'bg-purple-100 text-purple-800' :
                                                                                        roleKey === 'twg' ? 'bg-amber-100 text-amber-800' :
                                                                                        roleKey === 'pacco' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                                                        roleKey === 'head' ? 'bg-blue-100 text-blue-800' :
                                                                                        roleKey === 'authorized_staff' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                                                                                        'bg-slate-100 text-slate-700'
                                                                                    }`}
                                                                                >
                                                                                    {roleKey === 'super_admin' ? 'Super Administrator' :
                                                                                     roleKey === 'admin' ? 'Administrator' :
                                                                                     roleKey === 'budget_officer' ? 'Budget Officer' :
                                                                                     roleKey === 'oppmo' ? 'OPPMO' :
                                                                                     roleKey === 'twg' ? 'TWG' :
                                                                                     roleKey === 'pacco' ? 'PACCO Reviewer' :
                                                                                     roleKey === 'head' ? 'Head of Office' :
                                                                                     roleKey === 'authorized_staff' ? 'Authorize Staff' :
                                                                                     roleKey === 'monitor' ? 'Monitor' :
                                                                                     'End User'}
                                                                                </span>
                                                                            ))}
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
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
                                                                                    title="View Authorization Letter PDF"
                                                                                >
                                                                                    <FileText className="w-3 h-3 text-teal-600 shrink-0" />
                                                                                    <span>PDF Letter</span>
                                                                                </a>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setSignaturePreviewUser(u)}
                                                                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1 py-0.5 rounded transition cursor-pointer ${
                                                                                    u.signature_path
                                                                                        ? 'text-indigo-700 hover:text-indigo-900 underline underline-offset-2 hover:bg-indigo-50 font-semibold'
                                                                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                                                                                }`}
                                                                                title={u.signature_path ? 'View / Manage Official Signature' : 'Upload or Draw Specimen Signature'}
                                                                            >
                                                                                <PenTool className="w-3 h-3 text-indigo-600 shrink-0" />
                                                                                <span>
                                                                                    {u.signature_path
                                                                                        ? u.pnpki_signature?.signature_type === 'pnpki'
                                                                                            ? 'PNPKI E-Sig'
                                                                                            : 'Optional Sig'
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
                                                                                            <FileText className="w-3 h-3 text-emerald-600 shrink-0" />
                                                                                            <span>PNPKI PDF</span>
                                                                                        </a>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {u.pnpki_signature?.renewal_status === 'pending' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setSignaturePreviewUser(u)}
                                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 animate-pulse cursor-pointer"
                                                                                    title={`Pending PNPKI Renewal (New Exp: ${u.pnpki_signature.pending_expiration_date}) — Click to Review & Approve`}
                                                                                >
                                                                                    <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                                                                    <span>Renewal Pending Approval</span>
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center gap-1 flex-wrap mt-1">
                                                                            {u.role === 'super_admin' || u.role === 'admin' ? (
                                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9.5px] font-bold border border-purple-200">
                                                                                    <Shield className="w-2.5 h-2.5 text-purple-600" />
                                                                                    All Systems (Full)
                                                                                </span>
                                                                            ) : Array.isArray(u.accessible_systems) && u.accessible_systems.length > 0 ? (
                                                                                u.accessible_systems.map((url) => (
                                                                                    <span
                                                                                        key={url}
                                                                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                                                                                            url === '/eprocrementppmpapp'
                                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                                : url === '/monitoringsystem'
                                                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                                : url === '/pims'
                                                                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                                        }`}
                                                                                    >
                                                                                        {url === '/eprocrementppmpapp' ? 'PPMP/APP' : url === '/monitoringsystem' ? 'Monitoring' : url === '/pims' ? 'PIMS' : url === '/supplierevaluation' ? 'Supplier Eval' : 'Portal'}
                                                                                    </span>
                                                                                ))
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9.5px] font-medium">
                                                                                    {u.role === 'monitor' ? 'Monitoring' : 'PPMP/APP'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3">
                                                                    {isRejected ? (
                                                                        <div className="flex flex-col gap-0.5 items-start">
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[11px] font-semibold">
                                                                                <UserX className="w-3 h-3 text-rose-600" /> Rejected
                                                                            </span>
                                                                            {u.rejection_reason && (
                                                                                <span className="text-[10px] text-slate-500 max-w-[160px] truncate" title={u.rejection_reason}>
                                                                                    {u.rejection_reason}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : isPending ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-semibold animate-pulse">
                                                                            <Clock className="w-3 h-3" /> Pending
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold">
                                                                            <CheckCircle2 className="w-3 h-3" /> Active
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <UserActionDropdown
                                                                        user={u}
                                                                        currentUser={user}
                                                                        isPending={isPending}
                                                                        isRejected={isRejected}
                                                                        onToggleStatus={() => handleToggleUserStatus(u)}
                                                                        onChangeRole={() => setRoleModalUser(u)}
                                                                        onResetPassword={() => openPasswordModal(u)}
                                                                        onManageSystems={() => setSelectedUserForSystems(u)}
                                                                        onManageSignature={() => setSignaturePreviewUser(u)}
                                                                        onApprove={() => handleApproveUser(u)}
                                                                        onReject={() => openRejectModal(u)}
                                                                        onDelete={() => handleDeleteUser(u)}
                                                                        isProcessing={processingUserId === u.id}
                                                                        openUpward={index >= paginated.length - 2 && paginated.length > 2}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                    {(() => {
                                        let filtered = usersList;
                                        if (userTab === 'pending') filtered = filtered.filter(u => !u.is_active && u.approval_status !== 'rejected');
                                        else if (userTab === 'active') filtered = filtered.filter(u => u.is_active && u.approval_status !== 'rejected');
                                        else if (userTab === 'rejected') filtered = filtered.filter(u => u.approval_status === 'rejected');
                                        if (userSearch) {
                                            const q = userSearch.toLowerCase();
                                            filtered = filtered.filter(u =>
                                                u.name?.toLowerCase().includes(q) ||
                                                u.email?.toLowerCase().includes(q) ||
                                                u.office?.name?.toLowerCase().includes(q) ||
                                                u.phone_number?.toLowerCase().includes(q)
                                            );
                                        }
                                        if (filtered.length === 0) return null;
                                        const totalItems = filtered.length;
                                        const totalPages = Math.ceil(totalItems / userPerPage) || 1;
                                        const safePage = Math.min(userPage, totalPages);
                                        return (
                                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                                <PaginationControl
                                                    currentPage={safePage}
                                                    totalPages={totalPages}
                                                    onPageChange={setUserPage}
                                                    perPage={userPerPage}
                                                    onPerPageChange={setUserPerPage}
                                                    totalEntries={totalItems}
                                                    startIndex={(safePage - 1) * userPerPage}
                                                    endIndex={safePage * userPerPage}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {(adminSection === 'overview' || adminSection === 'offices') && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-blue-600" />
                                                Implementing Offices &amp; Departments
                                            </h2>
                                            <span className="text-xs text-slate-500">
                                                Manage provincial offices, abbreviations, heads, designations, and responsibility center numbers
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="relative w-full sm:w-56">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    placeholder="Search office / code..."
                                                    value={officeSearch}
                                                    onChange={(e) => { setOfficeSearch(e.target.value); setOfficePage(1); }}
                                                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setImportData([]); setImportFileName(''); setImportError(''); setImportSuccess(''); setIsImportModalOpen(true); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                            >
                                                <Upload className="w-3.5 h-3.5" />
                                                Import CSV / Excel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openOfficeModal()}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Add Office
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-3">Abbreviation / Code</th>
                                                    <th className="p-3">Office Name</th>
                                                    <th className="p-3">Head of Office</th>
                                                    <th className="p-3">Designation</th>
                                                    <th className="p-3">Responsibility No.</th>
                                                    <th className="p-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(() => {
                                                    const filteredOffices = officesList.filter(off => {
                                                        if (!officeSearch) return true;
                                                        const q = officeSearch.toLowerCase();
                                                        return off.code?.toLowerCase().includes(q) ||
                                                            off.name?.toLowerCase().includes(q) ||
                                                            off.head_name?.toLowerCase().includes(q) ||
                                                            off.responsibility_number?.toLowerCase().includes(q);
                                                    });
                                                    if (filteredOffices.length === 0) return (
                                                        <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic">{officeSearch ? 'No offices match your search query.' : 'No offices registered. Click "Add Office" or "Import CSV / Excel".'}</td></tr>
                                                    );
                                                    const totalPages = Math.ceil(filteredOffices.length / officePerPage) || 1;
                                                    const safePage = Math.min(officePage, totalPages);
                                                    const paginated = filteredOffices.slice((safePage - 1) * officePerPage, safePage * officePerPage);
                                                    return paginated.map(off => (
                                                        <tr key={off.id} className="hover:bg-slate-50 transition">
                                                            <td className="p-3 font-mono font-bold text-blue-900">{off.code || off.abbreviation || '—'}</td>
                                                            <td className="p-3 font-medium text-slate-800 max-w-xs truncate" title={off.name || off.office_name}>{off.name || off.office_name || '—'}</td>
                                                            <td className="p-3 text-slate-700">{off.head_name || '—'}</td>
                                                            <td className="p-3 text-slate-600">{off.designation || '—'}</td>
                                                            <td className="p-3 font-mono text-slate-700">{off.responsibility_number || '—'}</td>
                                                            <td className="p-3 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button onClick={() => openOfficeModal(off)} className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-semibold transition">Edit</button>
                                                                    <button onClick={() => handleDeleteOffice(off.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded transition" title="Delete office"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                    {(() => {
                                        const filteredOffices = officesList.filter(off => {
                                            if (!officeSearch) return true;
                                            const q = officeSearch.toLowerCase();
                                            return off.code?.toLowerCase().includes(q) || off.name?.toLowerCase().includes(q) || off.head_name?.toLowerCase().includes(q) || off.responsibility_number?.toLowerCase().includes(q);
                                        });
                                        if (filteredOffices.length === 0) return null;
                                        const totalItems = filteredOffices.length;
                                        const totalPages = Math.ceil(totalItems / officePerPage) || 1;
                                        const safePage = Math.min(officePage, totalPages);
                                        return (
                                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                                <PaginationControl
                                                    currentPage={safePage}
                                                    totalPages={totalPages}
                                                    onPageChange={setOfficePage}
                                                    perPage={officePerPage}
                                                    onPerPageChange={setOfficePerPage}
                                                    totalEntries={totalItems}
                                                    startIndex={(safePage - 1) * officePerPage}
                                                    endIndex={safePage * officePerPage}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isSignatoryModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsSignatoryModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                    {editingSignatory ? 'Edit Signatory' : 'Add Signatory'}
                                </h3>
                                <button type="button" onClick={() => setIsSignatoryModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleSaveSignatory} className="p-5 space-y-4">
                                {signatoryError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{signatoryError}</div>}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Signatory Role / Box</label>
                                    <select value={signatoryForm.signatory_type} onChange={e => setSignatoryForm(f => ({ ...f, signatory_type: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                        <option value="budget_requirement">Reviewed as to Budgetary Requirement (Provincial Budget Office)</option>
                                        <option value="pacco_requirement">Reviewed as to Budgetary Requirement (PACCO / Trust Fund)</option>
                                        <option value="bac_secretariat">Reviewed by BAC-Secretariat</option>
                                        <option value="approved_by">Approved by: (Governor)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Official Name</label>
                                    <input type="text" value={signatoryForm.name || ''} onChange={e => setSignatoryForm(f => ({ ...f, name: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Hon. Maria Clara Santos" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Position / Designation</label>
                                    <input type="text" value={signatoryForm.position || ''} onChange={e => setSignatoryForm(f => ({ ...f, position: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Provincial Budget Officer" required />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="sig-active" checked={signatoryForm.is_active} onChange={e => setSignatoryForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <label htmlFor="sig-active" className="text-xs font-medium text-slate-700">Set as Active Official</label>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setIsSignatoryModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">Cancel</button>
                                    <button type="submit" disabled={savingSignatory} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer">
                                        <Save className="w-3.5 h-3.5" />
                                        {savingSignatory ? 'Saving...' : (editingSignatory ? 'Update Signatory' : 'Save Signatory')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isPasswordModalOpen && selectedUserForPassword && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsPasswordModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Key className="w-4 h-4 text-blue-600" />
                                    Reset Password
                                </h3>
                                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleSavePassword} className="p-5 space-y-4">
                                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                                    Resetting password for: <strong className="text-slate-900">{selectedUserForPassword.name}</strong>
                                </div>
                                {passwordError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{passwordError}</div>}
                                {passwordSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">{passwordSuccess}</div>}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full text-xs pl-8 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Min. 8 characters" required minLength={8} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full text-xs pl-8 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Repeat new password" required />
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">Cancel</button>
                                    <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer">
                                        <Key className="w-3.5 h-3.5" />
                                        {savingPassword ? 'Saving...' : 'Reset Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isOfficeModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsOfficeModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    {editingOffice ? 'Edit Office' : 'Add New Office'}
                                </h3>
                                <button type="button" onClick={() => setIsOfficeModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
                            </div>
                            <form onSubmit={handleSaveOffice} className="p-5 space-y-4">
                                {officeError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">{officeError}</div>}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Abbreviation / Code</label>
                                        <input type="text" value={officeForm.abbreviation || ''} onChange={e => setOfficeForm(f => ({ ...f, abbreviation: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. PBO" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Responsibility No.</label>
                                        <input type="text" value={officeForm.responsibility_number || ''} onChange={e => setOfficeForm(f => ({ ...f, responsibility_number: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. 1021" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Office Name</label>
                                    <input type="text" value={officeForm.office_name || ''} onChange={e => setOfficeForm(f => ({ ...f, office_name: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Full office name" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Head of Office</label>
                                    <input type="text" value={officeForm.head_name || ''} onChange={e => setOfficeForm(f => ({ ...f, head_name: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Full name of office head" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Title</label>
                                    <input type="text" value={officeForm.designation || ''} onChange={e => setOfficeForm(f => ({ ...f, designation: e.target.value }))} className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Provincial Budget Officer" />
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setIsOfficeModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">Cancel</button>
                                    <button type="submit" disabled={savingOffice} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer">
                                        <Save className="w-3.5 h-3.5" />
                                        {savingOffice ? 'Saving...' : (editingOffice ? 'Update Office' : 'Save Office')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isImportModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsImportModalOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Upload className="w-4 h-4 text-emerald-600" />
                                    Import Offices from CSV / Excel
                                </h3>
                                <button type="button" onClick={() => setIsImportModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
                                    <div className="font-bold">Required columns: <span className="font-mono">abbreviation, office_name, head_name, designation, responsibility_number</span></div>
                                    <button type="button" onClick={downloadSampleCsv} className="text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-1"><Download className="w-3 h-3" />Download sample template</button>
                                </div>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition" onClick={() => fileInputRef.current?.click()}>
                                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <div className="text-sm font-semibold text-slate-700">{importFileName || 'Click to select CSV or Excel file'}</div>
                                    <div className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx, .xls</div>
                                </div>
                                {importError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{importError}</span></div>}
                                {importSuccess && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /><span>{importSuccess}</span></div>}
                                {importData.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase">
                                            <span>Preview Data ({importData.length} offices detected):</span>
                                            <span className="text-emerald-600 font-mono">Ready to import</span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100 sticky top-0 font-semibold text-slate-700 border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-2">Abbr</th>
                                                        <th className="p-2">Office Name</th>
                                                        <th className="p-2">Head Name</th>
                                                        <th className="p-2">Designation</th>
                                                        <th className="p-2">Resp No</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                    {importData.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="p-2 font-bold text-blue-900">{row.abbreviation}</td>
                                                            <td className="p-2 font-sans font-medium text-slate-800 truncate max-w-[180px]">{row.office_name}</td>
                                                            <td className="p-2 text-slate-600 truncate max-w-[140px]">{row.head_name || '-'}</td>
                                                            <td className="p-2 text-slate-600 truncate max-w-[140px]">{row.designation || '-'}</td>
                                                            <td className="p-2 text-slate-700">{row.responsibility_number || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">Cancel</button>
                                    <button type="button" onClick={handleExecuteImport} disabled={importing || importData.length === 0} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer">
                                        <Check className="w-3.5 h-3.5" />
                                        {importing ? 'Importing Offices...' : `Execute Import (${importData.length} records)`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isRejectModalOpen && selectedUserForReject && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeRejectModal}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
                                <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                                    <UserX className="w-4 h-4" />
                                    Reject User Registration
                                </h3>
                                <button type="button" onClick={closeRejectModal} className="p-1 text-white/80 hover:text-white rounded-lg transition">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleConfirmRejectUser} className="p-5 space-y-4">
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase font-semibold">User Details</div>
                                    <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedUserForReject.name}</div>
                                    <div className="text-xs text-slate-600 font-mono">{selectedUserForReject.email}</div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        Role: <span className="font-semibold text-slate-700">{selectedUserForReject.role}</span> • {selectedUserForReject.office?.name || 'Provincial Capitol'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Reason for Rejection <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="State why this registration is rejected (e.g. Incomplete credentials, invalid office designation)..."
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                        maxLength={500}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        This reason will be recorded and shown in the rejected users tab and when the user attempts to log in.
                                    </p>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={closeRejectModal}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={rejectingUser}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                                    >
                                        <UserX className="w-3.5 h-3.5" />
                                        {rejectingUser ? 'Rejecting...' : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <UserSignatureModal
                    user={signaturePreviewUser}
                    isOpen={Boolean(signaturePreviewUser)}
                    onClose={() => setSignaturePreviewUser(null)}
                    currentUserRole={user?.role}
                    onUpdated={(updatedUser) => {
                        setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                        setSignaturePreviewUser(null);
                        setUserActionFeedback({ type: 'success', text: `Signature for ${updatedUser.name} updated successfully.` });
                    }}
                />

                <CreateUserModal
                    isOpen={isCreateUserModalOpen}
                    onClose={() => setIsCreateUserModalOpen(false)}
                    offices={officesList}
                    currentUserRole={user?.role}
                    onSuccess={(newUser, msg) => {
                        setUsersList(prev => [newUser, ...prev]);
                        setUserActionFeedback({ type: 'success', text: msg || 'User created successfully.' });
                    }}
                />

                <UserSystemAccessModal
                    isOpen={Boolean(selectedUserForSystems)}
                    targetUser={selectedUserForSystems}
                    onClose={() => setSelectedUserForSystems(null)}
                    onSuccess={(updatedUser) => {
                        setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                        setUserActionFeedback({
                            type: 'success',
                            text: `Digital system access permissions for ${updatedUser.name} updated successfully.`
                        });
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        Welcome, {user?.name}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Procurement Management Workspace • {user?.office?.name || (user?.role === 'pacco' ? 'Provincial Accounting Office' : 'Provincial Capitol')}
                    </p>
                </div>

                {user?.role === 'end_user' && (
                    <button
                        onClick={() => onNavigate('create')}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition self-start sm:self-auto"
                    >
                        + Prepare New PPMP
                    </button>
                )}

                {(user?.role === 'budget_officer' || user?.role === 'pacco') && (
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setReviewerView('queue')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                reviewerView === 'queue'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span>PPMP Review Queue</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setReviewerView('fund_sources')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                reviewerView === 'fund_sources'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <Landmark className="w-3.5 h-3.5" />
                            <span>Sources of Fund</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                                reviewerView === 'fund_sources'
                                    ? 'bg-blue-800 text-blue-100'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                                Manage
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {(user?.role === 'budget_officer' || user?.role === 'pacco') && reviewerView === 'fund_sources' ? (
                <div className="space-y-6">
                    <FundSourcesManagement user={user} />
                </div>
            ) : (
                <>

                    {(user?.role === 'budget_officer' || user?.role === 'pacco') && (
                        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
                            <div className="flex items-start sm:items-center gap-3.5">
                                <div className="p-3 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30 shrink-0">
                                    <Landmark className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-xs tracking-tight text-white uppercase">
                                            Sources of Fund Management &amp; Review Routing
                                        </span>
                                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full border border-emerald-500/30">
                                            {user.role === 'pacco' ? 'PACCO Reviewer Catalog' : 'Budget Officer Catalog'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                        Configure official fund classifications, account codes, and review routes (General Fund, 20% DF, Special Health/Education, or Trust Funds).
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewerView('fund_sources')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
                            >
                                <Landmark className="w-3.5 h-3.5" />
                                <span>Manage Sources of Fund</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

            <div className={`grid gap-3 sm:gap-4 ${
                user?.role === 'twg'
                    ? 'grid-cols-2 md:grid-cols-4'
                    : (['budget_officer', 'oppmo', 'pacco', 'head', 'authorized_staff'].includes(user?.role)
                        ? 'grid-cols-1 sm:grid-cols-3'
                        : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6')
            }`}>
                {user?.role === 'end_user' && (
                    <>
                        <div
                            onClick={() => {
                                setPpmpTab('DRAFT');
                                setPpmpPage(1);
                            }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 transition"
                            title="Click to view Draft PPMPs"
                        >
                            <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-900">{counts.DRAFT ?? metrics.draft ?? 0}</div>
                                <div className="text-xs font-medium text-slate-500">Draft PPMPs</div>
                            </div>
                        </div>

                        <div
                            onClick={() => {
                                setPpmpTab('HEAD_PENDING');
                                setPpmpPage(1);
                            }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-amber-300 hover:bg-amber-50/50 transition"
                            title="Click to view Pending Head Approval"
                        >
                            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-amber-900">{counts.HEAD_PENDING ?? metrics.head_pending ?? 0}</div>
                                <div className="text-xs font-medium text-slate-500">Pending Head Approval</div>
                            </div>
                        </div>

                        <div
                            onClick={() => {
                                setPpmpTab('HEAD_APPROVED');
                                setPpmpPage(1);
                            }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition"
                            title="Click to view Endorsed by Head"
                        >
                            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-blue-900">{counts.HEAD_APPROVED ?? metrics.ready_for_review ?? 0}</div>
                                <div className="text-xs font-medium text-slate-500">Endorsed by Head</div>
                            </div>
                        </div>

                        <div
                            onClick={() => {
                                setPpmpTab('IN_REVIEW');
                                setInReviewSubFilter('');
                                setPpmpPage(1);
                            }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                            title="Click to view PPMPs In Formal Review"
                        >
                            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-indigo-900">{counts.IN_REVIEW ?? metrics.in_review ?? 0}</div>
                                <div className="text-xs font-medium text-slate-500">In Formal Review</div>
                            </div>
                        </div>

                        <div
                            onClick={() => {
                                setPpmpTab('RETURNED');
                                setReturnedSubFilter('');
                                setPpmpPage(1);
                            }}
                            className={`bg-white p-4 rounded-xl border shadow-xs flex items-center gap-3 cursor-pointer transition ${
                                counts.RETURNED > 0
                                    ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50 hover:border-rose-400'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                            title="Click to view Suspended PPMPs Returned for Remarks"
                        >
                            <div className={`p-3 rounded-lg ${counts.RETURNED > 0 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-rose-900">
                                    {counts.RETURNED}
                                </div>
                                <div className="text-xs font-medium text-slate-500">Returned for Remarks</div>
                            </div>
                        </div>

                        <div
                            onClick={() => {
                                setPpmpTab('READY_TO_PRINT');
                                setPpmpPage(1);
                            }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50 transition"
                            title="Click to view Ready to Print PPMPs"
                        >
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                <Printer className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-900">{counts.READY_TO_PRINT ?? metrics.ready_to_print ?? 0}</div>
                                <div className="text-xs font-medium text-slate-500">Ready to Print</div>
                            </div>
                        </div>
                    </>
                )}

                {(user?.role === 'head' || user?.role === 'authorized_staff') && (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-amber-900">{metrics.pending_endorsement || 0}</div>
                                <div className="text-xs font-bold text-slate-700">Pending Endorsement</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-900">{metrics.endorsed_approved || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Endorsed / Approved</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-rose-100 text-rose-700 rounded-lg">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-rose-900">{metrics.returned || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Returned to End User</div>
                            </div>
                        </div>
                    </>
                )}

                {(user?.role === 'budget_officer' || user?.role === 'oppmo' || user?.role === 'twg' || user?.role === 'pacco') && (
                    <>
                        <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-blue-900">{metrics.pending_review || 0}</div>
                                <div className="text-xs font-bold text-slate-700 uppercase">
                                    {user?.role === 'pacco' ? 'Under Review Queue' : 'Pending Your Review'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-900">{metrics.approved || 0}</div>
                                <div className="text-xs font-medium text-slate-500">
                                    {user?.role === 'pacco' ? 'Cleared & Ready to Print' : 'Cleared & Approved'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-rose-100 text-rose-700 rounded-lg">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-rose-900">{metrics.returned || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Returned with Remarks</div>
                            </div>
                        </div>

                        {user?.role === 'twg' && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                    <Printer className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xl font-black text-emerald-900">{metrics.ready_to_print || 0}</div>
                                    <div className="text-xs font-medium text-slate-500">Ready to Print</div>
                                </div>
                            </div>
                        )}

                        {user?.role === 'pacco' && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                                <div className="p-3 bg-teal-100 text-teal-700 rounded-lg">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xl font-black text-teal-900">{metrics.total_review || metrics.total || 0}</div>
                                    <div className="text-xs font-medium text-slate-500">Total Review PPMPs</div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {user?.role === 'admin' && (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-900">{metrics.total_ppmps || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Total System PPMPs</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-slate-800">{metrics.draft || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Draft Status</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-amber-900">{metrics.head_pending || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Pending Head Approval</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-indigo-900">{metrics.in_review || 0}</div>
                                <div className="text-xs font-medium text-slate-500">In Active Review</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                                <Printer className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-900">{metrics.ready_to_print || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Ready to Print</div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center gap-3">
                            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xl font-black text-amber-900">{metrics.pending_amendments || 0}</div>
                                <div className="text-xs font-medium text-slate-500">Pending Amendments</div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {user?.role === 'end_user' && (
                <PimsPublishReminderCard
                    ppmps={recentPpmps}
                    hasPimsAccess={canUserAccessSystem(user, '/pims')}
                    onOpenPpmp={(uuid) => handleOpenDetails(uuid)}
                />
            )}

            {user?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-600" />
                                Official Signatories Configuration
                            </h2>
                            <span className="text-xs text-slate-500">
                                Configure the official names & designations for <strong>Reviewed as to Budgetary Requirement</strong>, <strong>Reviewed by BAC-Secretariat</strong>, and <strong>Approved by: (Governor)</strong>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => openSignatoryModal()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs self-start sm:self-auto cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            Add Signatory
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Signatory Role / Box</th>
                                    <th className="p-3">Full Official Name</th>
                                    <th className="p-3">Position / Designation</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {signatoriesList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                                            No signatories configured yet. Click "Add Signatory" to set up official signatories.
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalPages = Math.ceil(signatoriesList.length / signatoryPerPage) || 1;
                                        const safePage = Math.min(signatoryPage, totalPages);
                                        const startIndex = (safePage - 1) * signatoryPerPage;
                                        const paginated = signatoriesList.slice(startIndex, startIndex + signatoryPerPage);

                                        return paginated.map((sig) => (
                                            <tr key={sig.id} className="hover:bg-slate-50 transition">
                                                <td className="p-3">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                                                        sig.signatory_type === 'budget_requirement'
                                                            ? 'bg-indigo-100 text-indigo-800'
                                                            : sig.signatory_type === 'pacco_requirement'
                                                            ? 'bg-teal-100 text-teal-800'
                                                            : sig.signatory_type === 'bac_secretariat'
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        {sig.signatory_type === 'budget_requirement'
                                                            ? 'Reviewed as to Budgetary Requirement (PBO)'
                                                            : sig.signatory_type === 'pacco_requirement'
                                                            ? 'Reviewed as to Budgetary Requirement (PACCO)'
                                                            : sig.signatory_type === 'bac_secretariat'
                                                            ? 'Reviewed by BAC- Secretariat'
                                                            : 'Approved by: (Governor)'}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-bold text-slate-900">
                                                    {sig.name}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    {sig.position}
                                                </td>
                                                <td className="p-3">
                                                    {sig.is_active ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-medium text-[11px]">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Official
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px]">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openSignatoryModal(sig)}
                                                            className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-semibold transition"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSignatory(sig.id)}
                                                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                                            title="Delete signatory"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ));
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {signatoriesList.length > 0 && (() => {
                        const totalItems = signatoriesList.length;
                        const totalPages = Math.ceil(totalItems / signatoryPerPage) || 1;
                        const safePage = Math.min(signatoryPage, totalPages);
                        const startIndex = (safePage - 1) * signatoryPerPage;
                        const endIndex = safePage * signatoryPerPage;

                        return (
                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                <PaginationControl
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    onPageChange={setSignatoryPage}
                                    perPage={signatoryPerPage}
                                    onPerPageChange={setSignatoryPerPage}
                                    totalEntries={totalItems}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                />
                            </div>
                        );
                    })()}

                </div>
            )}

            {user?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                User Management & Credentials
                            </h2>
                            <span className="text-xs text-slate-500">
                                Review pending user registrations, manage active accounts, modify designations, and reset user passwords
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="relative w-full sm:w-64">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search name, email, office, phone..."
                                    value={userSearch}
                                    onChange={(e) => {
                                        setUserSearch(e.target.value);
                                        setUserPage(1);
                                    }}
                                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

                    {userActionFeedback.text && (
                        <div className={`px-5 py-3 text-xs flex items-center justify-between border-b ${userActionFeedback.type === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                            }`}>
                            <span>{userActionFeedback.text}</span>
                            <button
                                type="button"
                                onClick={() => setUserActionFeedback({ type: '', text: '' })}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="flex border-b border-slate-200 px-5 pt-3 bg-slate-50/50 gap-2 flex-wrap">
                        {(() => {
                            const pendingCount = usersList.filter(u => !u.is_active && u.approval_status !== 'rejected').length;
                            const activeCount = usersList.filter(u => u.is_active && u.approval_status !== 'rejected').length;
                            const rejectedCount = usersList.filter(u => u.approval_status === 'rejected').length;
                            const totalCount = usersList.length;

                            return (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserTab('all');
                                            setUserPage(1);
                                        }}
                                        className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${userTab === 'all'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        All Users
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                            {totalCount}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserTab('pending');
                                            setUserPage(1);
                                        }}
                                        className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${userTab === 'pending'
                                            ? 'border-amber-500 text-amber-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <Clock className="w-3.5 h-3.5" />
                                        Pending
                                        {pendingCount > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 animate-pulse">
                                                {pendingCount}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserTab('active');
                                            setUserPage(1);
                                        }}
                                        className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${userTab === 'active'
                                            ? 'border-emerald-600 text-emerald-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Active
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                            {activeCount}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserTab('rejected');
                                            setUserPage(1);
                                        }}
                                        className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${userTab === 'rejected'
                                            ? 'border-rose-600 text-rose-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <UserX className="w-3.5 h-3.5" />
                                        Rejected Users
                                        {rejectedCount > 0 && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                                {rejectedCount}
                                            </span>
                                        )}
                                    </button>
                                </>
                            );
                        })()}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">User & Contact</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Department / Office</th>
                                    <th className="p-3">Designation</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const filteredUsers = usersList
                                        .filter((u) => {

                                            if (userTab === 'pending') return !u.is_active && u.approval_status !== 'rejected';
                                            if (userTab === 'active') return u.is_active && u.approval_status !== 'rejected';
                                            if (userTab === 'rejected') return u.approval_status === 'rejected';
                                            return true;
                                        })
                                        .filter((u) => {
                                            if (!userSearch) return true;
                                            const query = userSearch.toLowerCase();
                                            return (
                                                u.name?.toLowerCase().includes(query) ||
                                                u.email?.toLowerCase().includes(query) ||
                                                u.phone_number?.toLowerCase().includes(query) ||
                                                u.role?.toLowerCase().includes(query) ||
                                                u.office?.name?.toLowerCase().includes(query) ||
                                                u.office?.code?.toLowerCase().includes(query) ||
                                                u.designation?.toLowerCase().includes(query)
                                            );
                                        });

                                    if (filteredUsers.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                                                    No users found matching the selected criteria.
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const totalPages = Math.ceil(filteredUsers.length / userPerPage) || 1;
                                    const safePage = Math.min(userPage, totalPages);
                                    const startIndex = (safePage - 1) * userPerPage;
                                    const paginated = filteredUsers.slice(startIndex, startIndex + userPerPage);

                                    return paginated.map((u, index) => {
                                        const isProcessing = processingUserId === u.id;
                                        const isPending = !u.is_active && u.approval_status !== 'rejected';
                                        const isRejected = u.approval_status === 'rejected';

                                        return (
                                            <tr key={u.id} className="hover:bg-slate-50 transition">
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900">{u.name}</div>
                                                    <div className="text-slate-500 text-[11px] font-mono">{u.email}</div>
                                                    {u.phone_number && (
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Phone className="w-3 h-3 text-slate-400" />
                                                            {u.phone_number}
                                                        </div>
                                                    )}
                                                    {u.address && (
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-slate-400" />
                                                            <span className="truncate max-w-xs">{u.address}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                            {getUserRolesList(u).map((roleKey) => (
                                                                <span
                                                                    key={roleKey}
                                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${roleKey === 'admin' ? 'bg-red-100 text-red-800' :
                                                                        roleKey === 'super_admin' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                                                        roleKey === 'budget_officer' ? 'bg-indigo-100 text-indigo-800' :
                                                                            roleKey === 'oppmo' ? 'bg-purple-100 text-purple-800' :
                                                                                roleKey === 'twg' ? 'bg-cyan-100 text-cyan-800' :
                                                                                    roleKey === 'pacco' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                                                        roleKey === 'head' ? 'bg-amber-100 text-amber-800' :
                                                                                            roleKey === 'authorized_staff' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                                                                                                'bg-blue-100 text-blue-800'
                                                                        }`}
                                                                >
                                                                    {roleKey === 'super_admin' ? 'Super Administrator' :
                                                                        roleKey === 'admin' ? 'Administrator' :
                                                                        roleKey === 'budget_officer' ? 'Budget Officer' :
                                                                            roleKey === 'oppmo' ? 'OPPMO / Secretariat' :
                                                                                roleKey === 'twg' ? 'BAC-TWG Evaluator' :
                                                                                    roleKey === 'pacco' ? 'PACCO Reviewer' :
                                                                                        roleKey === 'head' ? 'Department Head' :
                                                                                            roleKey === 'authorized_staff' ? 'Authorize Staff' :
                                                                                                'End User'}
                                                                </span>
                                                            ))}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                            {getUserRolesList(u).includes('authorized_staff') && (
                                                                u.authorization_letter_path ? (
                                                                    <a
                                                                        href={`/api/users/${encodeURIComponent(u.encrypted_id)}/authorization-letter`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            userService.openSecureUserFile(u.encrypted_id, 'authorization-letter');
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-900 font-medium underline underline-offset-2 hover:bg-teal-50 px-1 py-0.5 rounded transition cursor-pointer"
                                                                        title="View Authorization Letter PDF"
                                                                    >
                                                                        <FileText className="w-3 h-3 text-teal-600 shrink-0" />
                                                                        <span>Letter (PDF)</span>
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 italic">No Letter PDF</span>
                                                                )
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setSignaturePreviewUser(u)}
                                                                className="inline-flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-900 font-medium underline underline-offset-2 hover:bg-indigo-50 px-1 py-0.5 rounded transition cursor-pointer"
                                                                title={u.signature_path ? "View / Manage Signature" : "Add / Upload Signature"}
                                                            >
                                                                <PenTool className="w-3 h-3 text-indigo-600 shrink-0" />
                                                                <span>{u.signature_path ? 'Signature' : 'No Signature (Add)'}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-700">
                                                    <div className="font-medium truncate max-w-xs">{u.office?.name || 'Provincial Capitol'}</div>
                                                    {u.office?.code && (
                                                        <span className="text-[10px] text-slate-400 font-mono">[{u.office.code}]</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    {u.designation || 'Staff / Officer'}
                                                </td>
                                                <td className="p-3">
                                                    {isRejected ? (
                                                        <div className="flex flex-col gap-0.5 items-start">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                                                <UserX className="w-3 h-3 text-rose-600" />
                                                                Rejected
                                                            </span>
                                                            {u.rejection_reason && (
                                                                <span className="text-[10px] text-slate-500 max-w-xs truncate" title={u.rejection_reason}>
                                                                    {u.rejection_reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : isPending ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            Pending Approval
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Active
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <UserActionDropdown
                                                        user={u}
                                                        currentUser={user}
                                                        isPending={isPending}
                                                        isRejected={isRejected}
                                                        onToggleStatus={() => handleToggleUserStatus(u)}
                                                        onChangeRole={() => setRoleModalUser(u)}
                                                        onResetPassword={() => openPasswordModal(u)}
                                                        onManageSystems={() => setSelectedUserForSystems(u)}
                                                        onApprove={() => handleApproveUser(u)}
                                                        onReject={() => openRejectModal(u)}
                                                        onDelete={() => handleDeleteUser(u)}
                                                        isProcessing={isProcessing}
                                                        openUpward={index >= paginated.length - 2 && paginated.length > 2}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    {(() => {
                        const filteredUsers = usersList
                            .filter((u) => {
                                if (userTab === 'pending') return !u.is_active && u.approval_status !== 'rejected';
                                if (userTab === 'active') return u.is_active && u.approval_status !== 'rejected';
                                if (userTab === 'rejected') return u.approval_status === 'rejected';
                                return true;
                            })
                            .filter((u) => {
                                if (!userSearch) return true;
                                const query = userSearch.toLowerCase();
                                return (
                                    u.name?.toLowerCase().includes(query) ||
                                    u.email?.toLowerCase().includes(query) ||
                                    u.phone_number?.toLowerCase().includes(query) ||
                                    u.role?.toLowerCase().includes(query) ||
                                    u.office?.name?.toLowerCase().includes(query) ||
                                    u.office?.code?.toLowerCase().includes(query) ||
                                    u.designation?.toLowerCase().includes(query)
                                );
                            });

                        const totalItems = filteredUsers.length;
                        if (totalItems === 0) return null;

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

            {user?.role === 'admin' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                Implementing Offices & Departments
                            </h2>
                            <span className="text-xs text-slate-500">
                                Manage provincial offices, abbreviations, heads, designations, and responsibility center numbers
                            </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">

                            <div className="relative w-full sm:w-56">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search office / code..."
                                    value={officeSearch}
                                    onChange={(e) => {
                                        setOfficeSearch(e.target.value);
                                        setOfficePage(1);
                                    }}
                                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setImportData([]);
                                    setImportFileName('');
                                    setImportError('');
                                    setImportSuccess('');
                                    setIsImportModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                Import CSV / Excel
                            </button>

                            <button
                                type="button"
                                onClick={() => openOfficeModal()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Office
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Abbreviation / Code</th>
                                    <th className="p-3">Office Name</th>
                                    <th className="p-3">Head of Office</th>
                                    <th className="p-3">Designation</th>
                                    <th className="p-3">Responsibility No.</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const filteredOffices = officesList
                                        .filter((off) => {
                                            if (!officeSearch) return true;
                                            const query = officeSearch.toLowerCase();
                                            return (
                                                off.code?.toLowerCase().includes(query) ||
                                                off.name?.toLowerCase().includes(query) ||
                                                off.head_name?.toLowerCase().includes(query) ||
                                                off.responsibility_number?.toLowerCase().includes(query)
                                            );
                                        });

                                    if (filteredOffices.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                                                    {officeSearch ? 'No offices match your search query.' : 'No offices registered. Click "Add Office" or "Import CSV / Excel".'}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const totalPages = Math.ceil(filteredOffices.length / officePerPage) || 1;
                                    const safePage = Math.min(officePage, totalPages);
                                    const startIndex = (safePage - 1) * officePerPage;
                                    const paginated = filteredOffices.slice(startIndex, startIndex + officePerPage);

                                    return paginated.map((off) => (
                                        <tr key={off.id} className="hover:bg-slate-50 transition">
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-xs text-blue-900">
                                                    {off.code}
                                                </span>
                                            </td>
                                            <td className="p-3 font-semibold text-slate-900 max-w-sm">
                                                {off.name}
                                            </td>
                                            <td className="p-3 text-slate-800">
                                                {off.head_name || off.head?.name || <span className="text-slate-400 italic">Unassigned</span>}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {off.designation || off.head?.designation || '-'}
                                            </td>
                                            <td className="p-3 font-mono text-slate-700">
                                                {off.responsibility_number ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] font-bold">
                                                        {off.responsibility_number}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => openOfficeModal(off)}
                                                        className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-semibold transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOffice(off.id)}
                                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                                        title="Delete office"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>

                    {(() => {
                        const filteredOffices = officesList
                            .filter((off) => {
                                if (!officeSearch) return true;
                                const query = officeSearch.toLowerCase();
                                return (
                                    off.code?.toLowerCase().includes(query) ||
                                    off.name?.toLowerCase().includes(query) ||
                                    off.head_name?.toLowerCase().includes(query) ||
                                    off.responsibility_number?.toLowerCase().includes(query)
                                );
                            });

                        const totalItems = filteredOffices.length;
                        if (totalItems === 0) return null;

                        const totalPages = Math.ceil(totalItems / officePerPage) || 1;
                        const safePage = Math.min(officePage, totalPages);
                        const startIndex = (safePage - 1) * officePerPage;
                        const endIndex = safePage * officePerPage;

                        return (
                            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                                <PaginationControl
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    onPageChange={setOfficePage}
                                    perPage={officePerPage}
                                    onPerPageChange={setOfficePerPage}
                                    totalEntries={totalItems}
                                    startIndex={startIndex}
                                    endIndex={endIndex}
                                />
                            </div>
                        );
                    })()}
                </div>
            )}

            {user?.role === 'end_user' && counts.RETURNED > 0 && (
                <div className="bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="p-3 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
                            <AlertCircle className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-rose-950 uppercase tracking-tight">
                                    Action Required: {counts.RETURNED} Suspended PPMP{counts.RETURNED > 1 ? 's' : ''} Returned for Remarks
                                </span>
                                <span className="px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-black rounded-full border border-rose-300">
                                    Needs Compliance
                                </span>
                            </div>
                            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                                Reviewer findings or suspension remarks have been issued. Please review cell comments, make required corrections, and resubmit for approval.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setPpmpTab('RETURNED');
                            setReturnedSubFilter('');
                            setPpmpPage(1);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                        <span>View Suspended PPMPs</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                            Recent Procurement Plans (PPMPs)
                        </h2>
                        <span className="text-xs text-slate-500">Active PPMPs requiring attention or recent updates</span>
                    </div>

                    <button
                        onClick={() => onNavigate('ppmps')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        View All PPMPs <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {(() => {
                    const counts = statusCounts;

                    const role = user?.role;
                    let tabs = [];

                    if (role === 'end_user') {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All My PPMPs',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'DRAFT',
                                label: 'Drafts',
                                count: counts.DRAFT,
                                activeClass: 'bg-slate-700 text-white border-slate-700 shadow-sm',
                                inactiveClass: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
                                activeBadge: 'bg-slate-900 text-slate-100',
                                inactiveBadge: 'bg-slate-200 text-slate-700 border border-slate-300',
                                dot: 'bg-slate-400',
                            },
                            {
                                key: 'HEAD_PENDING',
                                label: 'Pending Head',
                                count: counts.HEAD_PENDING,
                                activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
                                inactiveClass: 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100',
                                activeBadge: 'bg-amber-800 text-amber-100',
                                inactiveBadge: 'bg-amber-100 text-amber-800 border border-amber-300',
                                dot: 'bg-amber-500',
                            },
                            {
                                key: 'HEAD_APPROVED',
                                label: 'Head Endorsed',
                                count: counts.HEAD_APPROVED,
                                activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
                                inactiveClass: 'bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100',
                                activeBadge: 'bg-blue-800 text-blue-100',
                                inactiveBadge: 'bg-blue-100 text-blue-800 border border-blue-300',
                                dot: 'bg-blue-500',
                            },
                            {
                                key: 'IN_REVIEW',
                                label: 'In Review',
                                count: counts.IN_REVIEW,
                                activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
                                inactiveClass: 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100',
                                activeBadge: 'bg-indigo-800 text-indigo-100',
                                inactiveBadge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
                                dot: 'bg-indigo-500',
                            },
                            {
                                key: 'RETURNED',
                                label: 'Returned for Remarks',
                                count: counts.RETURNED,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                            {
                                key: 'READY_TO_PRINT',
                                label: 'Ready to Print',
                                count: counts.READY_TO_PRINT,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                        ];
                    } else if (role === 'head' || role === 'authorized_staff') {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All Office PPMPs',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'HEAD_PENDING',
                                label: 'Pending My Endorsement',
                                count: counts.HEAD_PENDING,
                                activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
                                inactiveClass: 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100',
                                activeBadge: 'bg-amber-800 text-amber-100',
                                inactiveBadge: 'bg-amber-100 text-amber-800 border border-amber-300',
                                dot: 'bg-amber-500',
                            },
                            {
                                key: 'ENDORSED_APPROVED',
                                label: 'Endorsed / Cleared',
                                count: categoryScopedPpmps.filter(p => !['DRAFT', 'HEAD_PENDING', 'HEAD_RETURNED'].includes(p.status)).length,
                                activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
                                inactiveClass: 'bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100',
                                activeBadge: 'bg-blue-800 text-blue-100',
                                inactiveBadge: 'bg-blue-100 text-blue-800 border border-blue-300',
                                dot: 'bg-blue-500',
                            },
                            {
                                key: 'HEAD_RETURNED',
                                label: 'Returned to Staff',
                                count: categoryScopedPpmps.filter(p => p.status === 'HEAD_RETURNED').length,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                        ];
                    } else if (role === 'budget_officer') {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All Review PPMPs',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'BUDGET_OFFICER_REVIEW',
                                label: 'Pending Budget Review',
                                count: counts.BUDGET_OFFICER_REVIEW,
                                activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
                                inactiveClass: 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100',
                                activeBadge: 'bg-indigo-800 text-indigo-100',
                                inactiveBadge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
                                dot: 'bg-indigo-500',
                            },
                            {
                                key: 'BUDGET_APPROVED',
                                label: 'Reviewed / Forwarded',
                                count: categoryScopedPpmps.filter(p => ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(p.status)).length,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                            {
                                key: 'BUDGET_OFFICER_RETURNED',
                                label: 'Returned with Remarks',
                                count: categoryScopedPpmps.filter(p => p.status === 'BUDGET_OFFICER_RETURNED').length,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                        ];
                    } else if (role === 'oppmo') {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All OPPMO Queue',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'OPPMO_REVIEW',
                                label: 'Pending OPPMO Review',
                                count: counts.OPPMO_REVIEW,
                                activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
                                inactiveClass: 'bg-purple-50/70 text-purple-900 border-purple-200 hover:bg-purple-100',
                                activeBadge: 'bg-purple-800 text-purple-100',
                                inactiveBadge: 'bg-purple-100 text-purple-800 border border-purple-300',
                                dot: 'bg-purple-500',
                            },
                            {
                                key: 'OPPMO_APPROVED',
                                label: 'Cleared / Ready to Print',
                                count: categoryScopedPpmps.filter(p => p.status === 'READY_TO_PRINT').length,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                            {
                                key: 'OPPMO_RETURNED',
                                label: 'Returned with Remarks',
                                count: categoryScopedPpmps.filter(p => p.status === 'OPPMO_RETURNED').length,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                        ];
                    } else if (role === 'twg') {

                        tabs = [
                            {
                                key: 'TWG_REVIEW',
                                label: 'Pending BAC-TWG Review',
                                count: counts.TWG_REVIEW,
                                activeClass: 'bg-cyan-600 text-white border-cyan-600 shadow-sm',
                                inactiveClass: 'bg-cyan-50/70 text-cyan-900 border-cyan-200 hover:bg-cyan-100',
                                activeBadge: 'bg-cyan-800 text-cyan-100',
                                inactiveBadge: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
                                dot: 'bg-cyan-500',
                            },
                            {
                                key: 'TWG_APPROVED',
                                label: 'Approved & Forwarded',
                                count: categoryScopedPpmps.filter(p => ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(p.status) && (p.twg_approved_at || p.signatures?.some(s => s.role === 'twg'))).length,
                                activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
                                inactiveClass: 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100',
                                activeBadge: 'bg-amber-800 text-amber-100',
                                inactiveBadge: 'bg-amber-100 text-amber-800 border border-amber-300',
                                dot: 'bg-amber-500',
                            },
                            {
                                key: 'READY_TO_PRINT',
                                label: 'Ready to Print',
                                count: counts.READY_TO_PRINT,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                            {
                                key: 'TWG_RETURNED',
                                label: 'Returned with Remarks',
                                count: categoryScopedPpmps.filter(p => p.status === 'TWG_RETURNED').length,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                            {
                                key: 'all',
                                label: 'All TWG Queue',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                        ];
                    } else if (role === 'pacco') {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All Review PPMPs',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'IN_REVIEW',
                                label: 'Under Review',
                                count: counts.IN_REVIEW,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                            {
                                key: 'READY_TO_PRINT',
                                label: 'Cleared / Ready to Print',
                                count: counts.READY_TO_PRINT,
                                activeClass: 'bg-teal-600 text-white border-teal-600 shadow-sm',
                                inactiveClass: 'bg-teal-50/70 text-teal-900 border-teal-200 hover:bg-teal-100',
                                activeBadge: 'bg-teal-800 text-teal-100',
                                inactiveBadge: 'bg-teal-100 text-teal-800 border border-teal-300',
                                dot: 'bg-teal-500',
                            },
                            {
                                key: 'RETURNED',
                                label: 'Returned with Remarks',
                                count: counts.RETURNED,
                                activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
                                inactiveClass: 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100',
                                activeBadge: 'bg-rose-800 text-rose-100',
                                inactiveBadge: 'bg-rose-100 text-rose-800 border border-rose-300',
                                dot: 'bg-rose-500',
                            },
                        ];
                    } else {

                        tabs = [
                            {
                                key: 'all',
                                label: 'All PPMPs',
                                count: counts.all,
                                activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
                                inactiveClass: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
                                activeBadge: 'bg-slate-800 text-slate-200',
                                inactiveBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
                                dot: 'bg-slate-500',
                            },
                            {
                                key: 'DRAFT',
                                label: 'Drafts',
                                count: counts.DRAFT,
                                activeClass: 'bg-slate-700 text-white border-slate-700 shadow-sm',
                                inactiveClass: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
                                activeBadge: 'bg-slate-900 text-slate-100',
                                inactiveBadge: 'bg-slate-200 text-slate-700 border border-slate-300',
                                dot: 'bg-slate-400',
                            },
                            {
                                key: 'HEAD_PENDING',
                                label: 'Pending Head',
                                count: counts.HEAD_PENDING,
                                activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
                                inactiveClass: 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100',
                                activeBadge: 'bg-amber-800 text-amber-100',
                                inactiveBadge: 'bg-amber-100 text-amber-800 border border-amber-300',
                                dot: 'bg-amber-500',
                            },
                            {
                                key: 'HEAD_APPROVED',
                                label: 'Head Endorsed',
                                count: counts.HEAD_APPROVED,
                                activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
                                inactiveClass: 'bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100',
                                activeBadge: 'bg-blue-800 text-blue-100',
                                inactiveBadge: 'bg-blue-100 text-blue-800 border border-blue-300',
                                dot: 'bg-blue-500',
                            },
                            {
                                key: 'BUDGET_OFFICER_REVIEW',
                                label: 'Budget Review',
                                count: counts.BUDGET_OFFICER_REVIEW,
                                activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
                                inactiveClass: 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100',
                                activeBadge: 'bg-indigo-800 text-indigo-100',
                                inactiveBadge: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
                                dot: 'bg-indigo-500',
                            },
                            {
                                key: 'PACCO_REVIEW',
                                label: 'PACCO Review',
                                count: counts.PACCO_REVIEW,
                                activeClass: 'bg-teal-600 text-white border-teal-600 shadow-sm',
                                inactiveClass: 'bg-teal-50/70 text-teal-900 border-teal-200 hover:bg-teal-100',
                                activeBadge: 'bg-teal-800 text-teal-100',
                                inactiveBadge: 'bg-teal-100 text-teal-800 border border-teal-300',
                                dot: 'bg-teal-500',
                            },
                            {
                                key: 'OPPMO_REVIEW',
                                label: 'OPPMO Review',
                                count: counts.OPPMO_REVIEW,
                                activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
                                inactiveClass: 'bg-purple-50/70 text-purple-900 border-purple-200 hover:bg-purple-100',
                                activeBadge: 'bg-purple-800 text-purple-100',
                                inactiveBadge: 'bg-purple-100 text-purple-800 border border-purple-300',
                                dot: 'bg-purple-500',
                            },
                            {
                                key: 'TWG_REVIEW',
                                label: 'BAC-TWG Review',
                                count: counts.TWG_REVIEW,
                                activeClass: 'bg-cyan-600 text-white border-cyan-600 shadow-sm',
                                inactiveClass: 'bg-cyan-50/70 text-cyan-900 border-cyan-200 hover:bg-cyan-100',
                                activeBadge: 'bg-cyan-800 text-cyan-100',
                                inactiveBadge: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
                                dot: 'bg-cyan-500',
                            },
                            {
                                key: 'READY_TO_PRINT',
                                label: 'Ready to Print',
                                count: counts.READY_TO_PRINT,
                                activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
                                inactiveClass: 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
                                activeBadge: 'bg-emerald-800 text-emerald-100',
                                inactiveBadge: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                                dot: 'bg-emerald-500',
                            },
                            {
                                key: 'PENDING_AMENDMENTS',
                                label: 'Pending Amendments',
                                count: counts.PENDING_AMENDMENTS,
                                activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
                                inactiveClass: 'bg-purple-50/70 text-purple-900 border-purple-200 hover:bg-purple-100',
                                activeBadge: 'bg-purple-800 text-purple-100',
                                inactiveBadge: 'bg-purple-100 text-purple-800 border border-purple-300',
                                dot: 'bg-purple-500',
                            },
                        ];
                    }

                    return (
                        <div className="flex items-center gap-2 px-5 pt-3 pb-2.5 border-b border-slate-200 overflow-x-auto bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300">
                            {tabs.map((tab) => {
                                const isActive = ppmpTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => {
                                            setPpmpTab(tab.key);
                                            setInReviewSubFilter('');
                                            setPpmpPage(1);
                                        }}
                                        className={`py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 rounded-lg border transition whitespace-nowrap shrink-0 cursor-pointer ${isActive
                                            ? tab.activeClass
                                            : tab.inactiveClass
                                            }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : tab.dot}`} />
                                        <span>{tab.label}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
                                            ? tab.activeBadge
                                            : tab.inactiveBadge
                                            }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })()}

                <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-lg">
                        <div className="relative w-full">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={ppmpSearch}
                                onChange={(e) => {
                                    setPpmpSearch(e.target.value);
                                    setPpmpPage(1);
                                }}
                                placeholder="Search by Tracker No, PPMP No, title, or office..."
                                className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition"
                            />
                            {ppmpSearch && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPpmpSearch('');
                                        setPpmpPage(1);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    title="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">

                        <select
                            value={ppmpYearFilter}
                            onChange={(e) => {
                                setPpmpYearFilter(e.target.value);
                                setPpmpPage(1);
                            }}
                            aria-label="Filter by Fiscal Year"
                            className="text-xs py-2 px-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        >
                            <option value="">All Fiscal Years</option>
                            {ppmpYearOptions.map((year) => (
                                <option key={year} value={year}>CY {year}</option>
                            ))}
                        </select>

                        {(ppmpSearch || ppmpYearFilter || inReviewSubFilter || returnedSubFilter || ppmpTab !== defaultPpmpTab) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPpmpSearch('');
                                    setPpmpYearFilter('');
                                    setInReviewSubFilter('');
                                    setReturnedSubFilter('');
                                    setPpmpTab(defaultPpmpTab);
                                    setPpmpPage(1);
                                }}
                                className="text-xs py-2 px-3 font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition flex items-center gap-1.5"
                                title="Reset search & filters"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {ppmpTab === 'IN_REVIEW' && (
                    <div className="px-5 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 mr-1 flex items-center gap-1">
                            Review Stage:
                        </span>

                        {[
                            {
                                key: '',
                                label: 'All Review Stages',
                                count: statusCounts.IN_REVIEW,
                                activeClass: 'bg-indigo-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/60',
                            },
                            {
                                key: 'TWG_REVIEW',
                                label: 'BAC-TWG Review',
                                count: categoryScopedPpmps.filter(p => p.status === 'TWG_REVIEW').length,
                                activeClass: 'bg-cyan-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-cyan-900 border border-cyan-200 hover:bg-cyan-100/60',
                                dot: 'bg-cyan-500',
                            },
                            {
                                key: 'BUDGET_OFFICER_REVIEW',
                                label: 'Budget Officer Review',
                                count: categoryScopedPpmps.filter(p => p.status === 'BUDGET_OFFICER_REVIEW').length,
                                activeClass: 'bg-indigo-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/60',
                                dot: 'bg-indigo-500',
                            },
                            {
                                key: 'PACCO_REVIEW',
                                label: 'PACCO Review',
                                count: categoryScopedPpmps.filter(p => p.status === 'PACCO_REVIEW').length,
                                activeClass: 'bg-teal-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100/60',
                                dot: 'bg-teal-500',
                            },
                            {
                                key: 'OPPMO_REVIEW',
                                label: 'OPPMO Review',
                                count: categoryScopedPpmps.filter(p => p.status === 'OPPMO_REVIEW').length,
                                activeClass: 'bg-purple-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/60',
                                dot: 'bg-purple-500',
                            },
                        ].map((sub) => {
                            const isSubActive = inReviewSubFilter === sub.key;
                            return (
                                <button
                                    key={sub.key}
                                    type="button"
                                    onClick={() => {
                                        setInReviewSubFilter(sub.key);
                                        setPpmpPage(1);
                                    }}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${isSubActive ? sub.activeClass : sub.inactiveClass
                                        }`}
                                >
                                    {sub.dot && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-white' : sub.dot}`} />
                                    )}
                                    <span>{sub.label}</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {sub.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {ppmpTab === 'RETURNED' && (
                    <div className="px-5 py-2.5 bg-rose-50/50 border-b border-rose-100 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900 mr-1 flex items-center gap-1">
                            Returned By:
                        </span>

                        {[
                            {
                                key: '',
                                label: 'All Suspended / Returned',
                                count: statusCounts.RETURNED,
                                activeClass: 'bg-rose-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-rose-900 border border-rose-200 hover:bg-rose-100/60',
                            },
                            {
                                key: 'HEAD_RETURNED',
                                label: 'Office Head',
                                count: categoryScopedPpmps.filter(p => p.status === 'HEAD_RETURNED').length,
                                activeClass: 'bg-amber-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-100/60',
                                dot: 'bg-amber-500',
                            },
                            {
                                key: 'TWG_RETURNED',
                                label: 'BAC-TWG',
                                count: categoryScopedPpmps.filter(p => p.status === 'TWG_RETURNED').length,
                                activeClass: 'bg-cyan-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-cyan-900 border border-cyan-200 hover:bg-cyan-100/60',
                                dot: 'bg-cyan-500',
                            },
                            {
                                key: 'BUDGET_OFFICER_RETURNED',
                                label: 'Budget Officer',
                                count: categoryScopedPpmps.filter(p => p.status === 'BUDGET_OFFICER_RETURNED').length,
                                activeClass: 'bg-indigo-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/60',
                                dot: 'bg-indigo-500',
                            },
                            {
                                key: 'PACCO_RETURNED',
                                label: 'PACCO Reviewer',
                                count: categoryScopedPpmps.filter(p => p.status === 'PACCO_RETURNED').length,
                                activeClass: 'bg-teal-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-teal-900 border border-teal-200 hover:bg-teal-100/60',
                                dot: 'bg-teal-500',
                            },
                            {
                                key: 'OPPMO_RETURNED',
                                label: 'OPPMO Reviewer',
                                count: categoryScopedPpmps.filter(p => p.status === 'OPPMO_RETURNED').length,
                                activeClass: 'bg-purple-600 text-white shadow-xs',
                                inactiveClass: 'bg-white text-purple-900 border border-purple-200 hover:bg-purple-100/60',
                                dot: 'bg-purple-500',
                            },
                        ].map((sub) => {
                            const isSubActive = returnedSubFilter === sub.key;
                            return (
                                <button
                                    key={sub.key}
                                    type="button"
                                    onClick={() => {
                                        setReturnedSubFilter(sub.key);
                                        setPpmpPage(1);
                                    }}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${isSubActive ? sub.activeClass : sub.inactiveClass
                                        }`}
                                >
                                    {sub.dot && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-white' : sub.dot}`} />
                                    )}
                                    <span>{sub.label}</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSubActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {sub.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {(() => {
                    const goodsFiltered = filteredRecentPpmps.filter((p) => !isInfrastructurePpmp(p));
                    const infraFiltered = filteredRecentPpmps.filter((p) => isInfrastructurePpmp(p));
                    const isInfraTab = ppmpCategoryTab === 'infrastructure';
                    const activeItems = isInfraTab ? infraFiltered : goodsFiltered;
                    const activeCurrentPage = isInfraTab ? ppmpInfraPage : ppmpPage;
                    const activeOnPageChange = isInfraTab ? setPpmpInfraPage : setPpmpPage;
                    const activePerPage = isInfraTab ? ppmpInfraPerPage : ppmpPerPage;
                    const activeOnPerPageChange = isInfraTab ? setPpmpInfraPerPage : setPpmpPerPage;
                    const activeEmptyLabel = isInfraTab ? 'Infrastructure PPMP' : 'Goods & Consulting Services PPMP';

                    const totalItems = activeItems.length;
                    const totalPages = Math.ceil(totalItems / activePerPage) || 1;
                    const safePage = Math.min(activeCurrentPage, totalPages);
                    const startIndex = (safePage - 1) * activePerPage;
                    const endIndex = Math.min(safePage * activePerPage, totalItems);
                    const paginated = activeItems.slice(startIndex, startIndex + activePerPage);

                    return (
                        <div>
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
                                            {goodsFiltered.length}
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
                                            {infraFiltered.length}
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
                                            <th className="p-3">Tracker No.</th>
                                            <th className="p-3">Project Title</th>
                                            <th className="p-3">Fiscal Year</th>
                                            <th className="p-3">Source of Funds</th>
                                            <th className="p-3">Total Budget</th>
                                            <th className="p-3">Workflow Status</th>
                                            <th className="p-3">Last Updated</th>
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginated.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="p-7 text-center text-slate-400 italic">
                                                    {ppmpSearch || ppmpYearFilter
                                                        ? `No ${activeEmptyLabel} records match your search and filter criteria.`
                                                        : `No ${activeEmptyLabel} records found for this status tab.`}
                                                </td>
                                            </tr>
                                        ) : (
                                            paginated.map((ppmp) => {
                                                const suppInfo = getSupplementalKindInfo(ppmp);
                                                const projectTypeLabel = getPpmpProjectTypeLabel(ppmp);
                                                const isInfra = projectTypeLabel === 'Infrastructure';
                                                return (
                                                    <tr key={ppmp.id} className="hover:bg-slate-50 transition">
                                                        <td className="p-3">
                                                            <div className="font-mono font-bold text-blue-900">
                                                                {ppmp.tracking_number || ppmp.ppmp_number}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                {ppmp.ppmp_number !== undefined && ppmp.ppmp_number !== null && (
                                                                    <span className="font-mono text-[11px] text-slate-600 font-semibold" title="PPMP Number">
                                                                        PPMP No. {ppmp.ppmp_number}
                                                                    </span>
                                                                )}
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
                                                        <td className="p-3 font-medium text-slate-800 max-w-sm">
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
                                                        </td>
                                                        <td className="p-3 text-slate-600 whitespace-nowrap">
                                                            CY {ppmp.fiscal_year} ({ppmp.plan_type})
                                                        </td>
                                                        <td className="p-3 text-slate-700">
                                                            <ExpandableFundBadge fund={ppmp.source_of_fund || ppmp.items?.find(i => i.source_of_fund)?.source_of_fund || 'General Fund'} />
                                                        </td>
                                                        <td className="p-3 font-mono font-bold text-slate-900">
                                                            {formatCurrency(ppmp.total_budget)}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <StatusBadge status={ppmp.status} />
                                                                {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse" title={suppInfo.specify ? `Specify: ${suppInfo.specify}` : ''}>
                                                                        Req. {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL'
                                                                            ? `Supplemental (${suppInfo.purpose === 'OTHER' ? (suppInfo.specify ? `Other: ${suppInfo.specify}` : 'Other') : 'Continuation'})`
                                                                            : 'Amendment'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-slate-500 text-[11px]">
                                                            {formatDate(ppmp.updated_at)}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                                {isAwaitingReceive(ppmp, user) ? (
                                                                    <button
                                                                        onClick={() => handleReceive(ppmp.uuid)}
                                                                        disabled={receivingUuids[ppmp.uuid]}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded transition text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                                                                        title="Click to acknowledge receipt of this document before viewing details"
                                                                    >
                                                                        {receivingUuids[ppmp.uuid] ? (
                                                                            <>
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                <span>Receiving...</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Inbox className="w-3.5 h-3.5" />
                                                                                <span>Receive</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleOpenDetails(ppmp.uuid)}
                                                                        disabled={openingUuids[ppmp.uuid]}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition text-xs shadow-xs cursor-pointer disabled:opacity-75"
                                                                    >
                                                                        {openingUuids[ppmp.uuid] ? (
                                                                            <>
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                <span>Opening...</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Eye className="w-3.5 h-3.5" />
                                                                                <span>Open Details</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalItems > 0 && (
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
                </>
            )}

            {isSignatoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-400" />
                                {editingSignatory ? 'Edit Official Signatory' : 'Add New Official Signatory'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsSignatoryModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSignatory} className="p-6 space-y-4">
                            {signatoryError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{signatoryError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Signatory Role / Review Box:
                                </label>
                                <select
                                    disabled={Boolean(editingSignatory)}
                                    value={signatoryForm.signatory_type}
                                    onChange={(e) => setSignatoryForm({ ...signatoryForm, signatory_type: e.target.value })}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                                >
                                    <option value="budget_requirement">
                                        Reviewed as to Budgetary Requirement (Provincial Budget Office)
                                    </option>
                                    <option value="pacco_requirement">
                                        Reviewed as to Budgetary Requirement (PACCO / Trust Fund)
                                    </option>
                                    <option value="bac_secretariat">
                                        Reviewed by BAC- Secretariat (OPPMO / BAC Secretariat)
                                    </option>
                                    <option value="approved_by">
                                        Approved by: (Governor)
                                    </option>
                                </select>
                                <span className="text-[11px] text-slate-400 mt-0.5 block">
                                    Determines which signature box on the official PPMP & APP documents this signatory represents.
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Full Official Name:
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={signatoryForm.name || ''}
                                    onChange={(e) => setSignatoryForm({ ...signatoryForm, name: e.target.value })}
                                    placeholder={signatoryForm.signatory_type === 'approved_by' ? 'e.g. Hon. Yvonne R. Cagas' : 'e.g. Atty. Roberto G. Almendras, CPA'}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Official Position / Designation:
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={signatoryForm.position || ''}
                                    onChange={(e) => setSignatoryForm({ ...signatoryForm, position: e.target.value })}
                                    placeholder={signatoryForm.signatory_type === 'approved_by' ? 'e.g. Provincial Governor' : 'e.g. Provincial Budget Officer or Head BAC Secretariat'}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={signatoryForm.is_active}
                                        onChange={(e) => setSignatoryForm({ ...signatoryForm, is_active: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-medium text-slate-700">
                                        Set as active official signatory for new and pending reviews
                                    </span>
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSignatoryModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSignatory}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {savingSignatory ? 'Saving...' : 'Save Signatory'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPasswordModalOpen && selectedUserForPassword && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Key className="w-4 h-4 text-amber-400" />
                                Change User Password
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsPasswordModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePassword} className="p-6 space-y-4">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-semibold">User Details</div>
                                <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedUserForPassword.name}</div>
                                <div className="text-xs text-slate-600 font-mono">{selectedUserForPassword.email}</div>
                                <div className="text-[11px] text-blue-700 font-semibold mt-1">
                                    Role: {selectedUserForPassword.role} • {selectedUserForPassword.office?.name || 'Provincial Capitol'}
                                </div>
                            </div>

                            {passwordError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            {passwordSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                    <span>{passwordSuccess}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    New Password:
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Confirm New Password:
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Retype new password"
                                        className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPasswordModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingPassword}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50"
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    {savingPassword ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isOfficeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-400" />
                                {editingOffice ? 'Edit Office Information' : 'Add New Office / Department'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsOfficeModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveOffice} className="p-6 space-y-4">
                            {officeError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{officeError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Abbreviation / Code:
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={officeForm.abbreviation || ''}
                                        onChange={(e) => setOfficeForm({ ...officeForm, abbreviation: e.target.value })}
                                        placeholder="e.g. PGO-ICTD"
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-blue-900 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Responsibility Center No:
                                    </label>
                                    <input
                                        type="text"
                                        value={officeForm.responsibility_number || ''}
                                        onChange={(e) => setOfficeForm({ ...officeForm, responsibility_number: e.target.value })}
                                        placeholder="e.g. 1011 or 1021"
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-slate-800"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Full Office Name:
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={officeForm.office_name || ''}
                                    onChange={(e) => setOfficeForm({ ...officeForm, office_name: e.target.value })}
                                    placeholder="e.g. Provincial Governor's Office - ICT Division"
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Head of Office (Name):
                                </label>
                                <input
                                    type="text"
                                    value={officeForm.head_name || ''}
                                    onChange={(e) => setOfficeForm({ ...officeForm, head_name: e.target.value })}
                                    placeholder="e.g. Hon. Maria Clara Santos"
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Designation / Title:
                                </label>
                                <input
                                    type="text"
                                    value={officeForm.designation || ''}
                                    onChange={(e) => setOfficeForm({ ...officeForm, designation: e.target.value })}
                                    placeholder="e.g. Department Head / Provincial ICT Officer"
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOfficeModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingOffice}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {savingOffice ? 'Saving...' : 'Save Office'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                                Import Offices in CSV or Excel
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">

                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                        Required Columns in File:
                                    </div>
                                    <div className="text-[11px] text-slate-600 font-mono mt-1">
                                        abbreviation, office_name, head_name, designation, responsibility_number
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={downloadSampleCsv}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 text-blue-600" />
                                    Download Sample CSV
                                </button>
                            </div>

                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
                                >
                                    <Upload className="w-8 h-8 text-blue-600" />
                                    <div className="text-xs font-bold text-slate-800">
                                        Click to browse or select your CSV or Excel file (.csv, .xlsx, .xls)
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        Auto-parses headers matching abbreviation, office_name, head_name, designation, responsibility_number
                                    </div>
                                    {importFileName && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-mono text-xs font-bold">
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                            Selected: {importFileName}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {importError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{importError}</span>
                                </div>
                            )}

                            {importSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                    <span>{importSuccess}</span>
                                </div>
                            )}

                            {importData.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase">
                                        <span>Preview Data ({importData.length} offices detected):</span>
                                        <span className="text-emerald-600 font-mono">Ready to import</span>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 sticky top-0 font-semibold text-slate-700 border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2">Abbr</th>
                                                    <th className="p-2">Office Name</th>
                                                    <th className="p-2">Head Name</th>
                                                    <th className="p-2">Designation</th>
                                                    <th className="p-2">Resp No</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                {importData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="p-2 font-bold text-blue-900">{row.abbreviation}</td>
                                                        <td className="p-2 font-sans font-medium text-slate-800 truncate max-w-[180px]">{row.office_name}</td>
                                                        <td className="p-2 text-slate-600 truncate max-w-[140px]">{row.head_name || '-'}</td>
                                                        <td className="p-2 text-slate-600 truncate max-w-[140px]">{row.designation || '-'}</td>
                                                        <td className="p-2 text-slate-700">{row.responsibility_number || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteImport}
                                    disabled={importing || importData.length === 0}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    {importing ? 'Importing Offices...' : `Execute Import (${importData.length} records)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isRejectModalOpen && selectedUserForReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" onClick={closeRejectModal}>
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                        <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <UserX className="w-4 h-4" />
                                Reject User Registration
                            </h3>
                            <button
                                type="button"
                                onClick={closeRejectModal}
                                className="text-white/80 hover:text-white p-1 rounded-md transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleConfirmRejectUser} className="p-6 space-y-4">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="text-xs text-slate-500 uppercase font-semibold">User Details</div>
                                <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedUserForReject.name}</div>
                                <div className="text-xs text-slate-600 font-mono">{selectedUserForReject.email}</div>
                                <div className="text-[11px] text-slate-500 mt-1">
                                    Role: <span className="font-semibold text-slate-700">{selectedUserForReject.role}</span> • {selectedUserForReject.office?.name || 'Provincial Capitol'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Reason for Rejection <span className="text-slate-400 font-normal lowercase">(optional)</span>:
                                </label>
                                <textarea
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Explain why this account registration was rejected..."
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                    maxLength={500}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    This reason will be recorded and visible to the applicant upon login.
                                </p>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeRejectModal}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectingUser}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <UserX className="w-3.5 h-3.5" />
                                    {rejectingUser ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <UserSignatureModal
                user={signaturePreviewUser}
                isOpen={Boolean(signaturePreviewUser)}
                onClose={() => setSignaturePreviewUser(null)}
                onUpdated={(updatedUser) => {
                    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                    setSignaturePreviewUser(null);
                    setUserActionFeedback({ type: 'success', text: `Signature for ${updatedUser.name} updated successfully.` });
                }}
            />

            <UserRolesModal
                user={roleModalUser}
                currentUserRole={user?.role}
                onClose={() => setRoleModalUser(null)}
                onSaved={(updatedUser, msg) => {
                    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
                    setUserActionFeedback({ type: 'success', text: msg || `Roles for ${updatedUser.name} updated successfully.` });
                }}
            />

            <CreateUserModal
                isOpen={isCreateUserModalOpen}
                onClose={() => setIsCreateUserModalOpen(false)}
                offices={officesList}
                currentUserRole={user?.role}
                onSuccess={(newUser, msg) => {
                    setUsersList(prev => [newUser, ...prev]);
                    setUserActionFeedback({ type: 'success', text: msg || 'User created successfully.' });
                }}
            />
        </div>
    );
};
