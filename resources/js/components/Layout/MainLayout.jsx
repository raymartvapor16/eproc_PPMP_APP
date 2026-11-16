import React, { useState, useEffect } from 'react';
import { notificationService, authService, ppmpService } from '../../services/api';
import { isAwaitingReceive, getStageReceiptInfo } from '../../utils/workflowHelpers';
import { showConfirm } from '../../utils/modalAlert';
import {
    LayoutDashboard,
    FileSpreadsheet,
    PlusCircle,
    Bell,
    LogOut,
    User,
    Shield,
    CheckCircle,
    Building2,
    Menu,
    X,
    ExternalLink,
    ArrowUpRight,
    Check,
    PenTool,
    Eraser,
    Edit3,
    Phone,
    MapPin,
    Mail,
    Save,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Inbox,
    Maximize2,
    Clock,
    Trash2,
    Info,
    RefreshCw,
    Search,
    CheckCheck,
    RotateCcw,
    Layers,
    Globe,
    Activity,
    Camera,
    Upload,
} from 'lucide-react';
import { canUserAccessSystem } from '../UI/UnauthorizedSystemAccessView';
import { SignaturePadModal } from '../UI/SignaturePadModal';
import { UserAvatar } from '../UI/UserAvatar';
import { SystemSwitcherDropdown } from './SystemSwitcherDropdown';

export const MainLayout = ({ user, activeTab, onNavigate, onSelectPpmp, onLogout, onUserUpdate, children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [showAllNotifsDrawer, setShowAllNotifsDrawer] = useState(false);
    const [allNotifications, setAllNotifications] = useState([]);
    const [loadingAllNotifs, setLoadingAllNotifs] = useState(false);
    const [notifFilter, setNotifFilter] = useState('all'); // 'all', 'unread', 'approved', 'review', 'returned'
    const [notifSearch, setNotifSearch] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const notifDropdownRef = React.useRef(null);
    const notifContainerRef = React.useRef(null);

    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const prevLatestNotifIdRef = React.useRef(null);
    const prevUnreadCountRef = React.useRef(null);

    const loadNotifications = async (isManual = false) => {
        if (isManual) setLoadingNotifs(true);
        try {
            const res = await notificationService.getAll();
            const newNotifs = res.data.notifications || [];
            const newUnreadCount = res.data.unread_count || 0;
            const latestId = newNotifs.length > 0 ? newNotifs[0].id : null;

            // Detect if notifications or unread count changed after initial load
            const isInitial = prevLatestNotifIdRef.current === null && prevUnreadCountRef.current === null;
            const hasChanged = !isInitial && (
                latestId !== prevLatestNotifIdRef.current || 
                newUnreadCount !== prevUnreadCountRef.current
            );

            prevLatestNotifIdRef.current = latestId;
            prevUnreadCountRef.current = newUnreadCount;

            setNotifications(newNotifs);
            setUnreadCount(newUnreadCount);

            // If "All Notifications" drawer is open, keep it in sync
            if (showAllNotifsDrawer) {
                try {
                    const allRes = await notificationService.getAll({ all: 1 });
                    setAllNotifications(allRes.data.notifications || []);
                } catch (err) {
                    // ignore
                }
            }

            // If notifications have updated, trigger automatic data reload for active views
            if (hasChanged) {
                window.dispatchEvent(new CustomEvent('app:data_reload', {
                    detail: {
                        unreadCount: newUnreadCount,
                        latestNotification: newNotifs[0] || null
                    }
                }));
            }
        } catch (e) {
            console.error('Failed to load notifications', e);
        } finally {
            if (isManual) setLoadingNotifs(false);
        }
    };

    const handleOpenAllNotifsDrawer = async () => {
        setShowNotifMenu(false);
        setShowAllNotifsDrawer(true);
        setLoadingAllNotifs(true);
        try {
            const res = await notificationService.getAll({ all: 1 });
            setAllNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unread_count || 0);
            prevUnreadCountRef.current = res.data.unread_count || 0;
        } catch (err) {
            console.error('Failed to load all notifications', err);
        } finally {
            setLoadingAllNotifs(false);
        }
    };

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(() => loadNotifications(false), 20000);

        const handleReloadSignal = () => {
            loadNotifications(false);
        };
        const handleWindowFocus = () => {
            loadNotifications(false);
        };

        window.addEventListener('notifications:reload', handleReloadSignal);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('notifications:reload', handleReloadSignal);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [showAllNotifsDrawer]);

    // Lock background page scroll and support Escape key when All Notifications drawer is open
    useEffect(() => {
        if (!showAllNotifsDrawer) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowAllNotifsDrawer(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showAllNotifsDrawer]);

    // Profile Modal & Edit States
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: '',
        phone_number: '',
        address: '',
        designation: '',
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [showSignaturePad, setShowSignaturePad] = useState(false);

    const [hasProfileSignatureDrawn, setHasProfileSignatureDrawn] = useState(false);
    const [signatureTimestamp, setSignatureTimestamp] = useState(Date.now());
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [profileSigDataUrl, setProfileSigDataUrl] = useState(null);

    // Profile Photo State
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
    const [removePhotoRequested, setRemovePhotoRequested] = useState(false);
    const [photoTimestamp, setPhotoTimestamp] = useState(Date.now());
    const photoFileInputRef = React.useRef(null);

    // When modal opens, initialize form with current user
    const handleOpenProfile = () => {
        setProfileForm({
            name: user?.name || '',
            phone_number: user?.phone_number || '',
            address: user?.address || '',
            designation: user?.designation || '',
        });
        setIsEditingProfile(false);
        setShowSignaturePad(false);
        setProfileError('');
        setProfileSuccess('');
        setHasProfileSignatureDrawn(false);
        setProfileSigDataUrl(null);
        setSelectedPhotoFile(null);
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        setPhotoPreviewUrl(null);
        setRemovePhotoRequested(false);
        setIsProfileModalOpen(true);
    };

    const handlePhotoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Security validation: JPEG and PNG only
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type.toLowerCase())) {
            setProfileError('Invalid format: Only JPEG and PNG images are allowed.');
            return;
        }

        // Max 2MB limit
        if (file.size > 2 * 1024 * 1024) {
            setProfileError('File size exceeds the 2MB limit. Please upload a smaller image.');
            return;
        }

        setProfileError('');
        setSelectedPhotoFile(file);
        setRemovePhotoRequested(false);
        const objectUrl = URL.createObjectURL(file);
        setPhotoPreviewUrl(objectUrl);
    };

    const handleRemovePhoto = () => {
        setSelectedPhotoFile(null);
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        setPhotoPreviewUrl(null);
        setRemovePhotoRequested(true);
    };

    const clearCanvas = (e) => {
        if (e) e.stopPropagation();
        setHasProfileSignatureDrawn(false);
        setProfileSigDataUrl(null);
    };

    const handleApplyProfileModalSignature = (dataUrl) => {
        if (dataUrl) {
            setProfileSigDataUrl(dataUrl);
            setHasProfileSignatureDrawn(true);
            setShowSignaturePad(true);
        } else {
            clearCanvas();
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileError('');
        setProfileSuccess('');

        try {
            // 1. Handle profile photo upload or removal
            if (selectedPhotoFile) {
                const formData = new FormData();
                formData.append('profile_photo', selectedPhotoFile);
                await authService.uploadProfilePhoto(formData);
                setPhotoTimestamp(Date.now());
            } else if (removePhotoRequested) {
                await authService.removeProfilePhoto();
                setPhotoTimestamp(Date.now());
            }

            // 2. Handle profile text details and drawn signature
            const sigDataUrl = hasProfileSignatureDrawn ? profileSigDataUrl : null;

            const payload = {
                ...profileForm,
                signature: sigDataUrl,
            };

            const res = await authService.updateProfile(payload);
            setProfileSuccess('Profile details and signature updated successfully!');
            setIsEditingProfile(false);
            setShowSignaturePad(false);
            setHasProfileSignatureDrawn(false);
            setSignatureTimestamp(Date.now());
            setSelectedPhotoFile(null);
            setRemovePhotoRequested(false);

            if (onUserUpdate && res.data?.user) {
                onUserUpdate(res.data.user);
            }
        } catch (err) {
            setProfileError(err.response?.data?.message || 'Failed to update profile details.');
        } finally {
            setProfileSaving(false);
        }
    };

    // Close notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifContainerRef.current && !notifContainerRef.current.contains(event.target)) {
                setShowNotifMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}h ago`;
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay < 7) return `${diffDay}d ago`;
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getNotifTypeBadge = (type, isUnread) => {
        let colorClass = 'bg-blue-500 ring-blue-200';
        let titleText = 'Notice';

        if (type === 'success') {
            colorClass = 'bg-emerald-500 ring-emerald-200';
            titleText = 'Approved / Completed';
        } else if (type === 'warning') {
            colorClass = 'bg-amber-500 ring-amber-200';
            titleText = 'Returned / Warning';
        } else if (type === 'danger') {
            colorClass = 'bg-rose-500 ring-rose-200';
            titleText = 'Action Required';
        }

        return (
            <span
                className={`w-2 h-2 rounded-full ${colorClass} shrink-0 ${isUnread ? 'ring-2 animate-pulse' : 'opacity-70'}`}
                title={titleText}
            />
        );
    };

    const handleMarkAllRead = async () => {
        try {
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
            );
            setAllNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
            );
            setUnreadCount(0);
            prevUnreadCountRef.current = 0;
            await notificationService.markAllAsRead();
            loadNotifications(false);
            window.dispatchEvent(new CustomEvent('app:data_reload'));
        } catch (e) {
            console.error('Failed to mark all read', e);
            loadNotifications(false);
        }
    };

    const handleDismissNotification = async (e, notifId) => {
        e.stopPropagation();
        try {
            setNotifications((prev) => prev.filter((n) => n.id !== notifId));
            setAllNotifications((prev) => prev.filter((n) => n.id !== notifId));
            setUnreadCount((prev) => Math.max(0, prev - 1));
            prevUnreadCountRef.current = Math.max(0, (prevUnreadCountRef.current || 1) - 1);
            await notificationService.delete(notifId);
            loadNotifications(false);
            window.dispatchEvent(new CustomEvent('app:data_reload'));
        } catch (err) {
            console.error('Failed to dismiss notification', err);
            loadNotifications(false);
        }
    };

    const handleClearAllNotifications = async () => {
        const confirmed = await showConfirm({
            title: 'Clear All Notifications',
            message: 'Are you sure you want to clear all notifications from your notification feed?',
            confirmText: 'Yes, Clear All',
            cancelText: 'Cancel',
            type: 'warning',
        });
        if (!confirmed) return;
        try {
            setNotifications([]);
            setAllNotifications([]);
            setUnreadCount(0);
            prevUnreadCountRef.current = 0;
            await notificationService.clearAll();
            loadNotifications(false);
            window.dispatchEvent(new CustomEvent('app:data_reload'));
        } catch (err) {
            console.error('Failed to clear all notifications', err);
            loadNotifications(false);
        }
    };

    // Receive Required Modal State for Notifications
    const [receiveRequiredPpmp, setReceiveRequiredPpmp] = useState(null);
    const [receivingNotifPpmp, setReceivingNotifPpmp] = useState(false);

    const handleConfirmReceiveFromModal = async () => {
        if (!receiveRequiredPpmp) return;
        setReceivingNotifPpmp(true);
        try {
            await ppmpService.receive(receiveRequiredPpmp.uuid);
            const targetUuid = receiveRequiredPpmp.uuid;
            setReceiveRequiredPpmp(null);
            loadNotifications(false);
            window.dispatchEvent(new CustomEvent('notifications:reload'));
            window.dispatchEvent(new CustomEvent('app:data_reload', { detail: { ppmpUuid: targetUuid } }));
            if (onSelectPpmp) {
                onSelectPpmp(targetUuid);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to acknowledge receipt of document.');
        } finally {
            setReceivingNotifPpmp(false);
        }
    };

    const handleNotificationClick = async (notif) => {
        // Mark notification as read
        if (!notif.read_at) {
            try {
                await notificationService.markAsRead(notif.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
                );
                setAllNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
                prevUnreadCountRef.current = Math.max(0, (prevUnreadCountRef.current || 1) - 1);
            } catch (e) {
                console.error('Failed to mark notification read', e);
            }
        }

        setShowNotifMenu(false);
        setShowAllNotifsDrawer(false);

        // If notification is linked to a PPMP
        if (notif.ppmp?.uuid) {
            // Check if current user is required to receive this document first
            if (isAwaitingReceive(notif.ppmp, user)) {
                setReceiveRequiredPpmp(notif.ppmp);
                return;
            }

            if (onSelectPpmp) {
                onSelectPpmp(notif.ppmp.uuid);
                window.dispatchEvent(new CustomEvent('app:data_reload', { detail: { ppmpUuid: notif.ppmp.uuid } }));
                return;
            }
        }

        if (['admin', 'super_admin'].includes(user?.role) && (notif.title?.toLowerCase().includes('user') || notif.message?.toLowerCase().includes('registered'))) {
            if (onNavigate) {
                onNavigate('users');
                window.dispatchEvent(new CustomEvent('app:data_reload'));
                return;
            }
        }

        if (onNavigate) {
            onNavigate('dashboard');
            window.dispatchEvent(new CustomEvent('app:data_reload'));
        }
    };

    const getRoleDisplayName = (role) => {
        switch (role) {
            case 'end_user': return 'End User / Project In-Charge';
            case 'head': return 'Department / Office Head';
            case 'authorized_staff': return 'Authorize Staff (Acting Head)';
            case 'budget_officer': return 'Provincial Budget Officer';
            case 'oppmo': return 'OPPMO / BAC Secretariat';
            case 'twg': return 'BAC-TWG Evaluator';
            case 'pacco': return 'PACCO Reviewer';
            case 'monitor': return 'OPPMO Monitoring Officer';
            case 'super_admin': return 'Super Administrator';
            case 'admin': return 'Administrator';
            default: return role;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md no-print">
                <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left Brand */}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-1.5 sm:p-2 rounded text-slate-400 hover:text-white shrink-0"
                                aria-label="Toggle navigation menu"
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>

                            <div
                                onClick={() => onNavigate('dashboard')}
                                className="cursor-pointer flex items-center gap-2 sm:gap-2.5 min-w-0 group"
                            >
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition">
                                        <img
                                            src="/images/logo.png"
                                            alt="Province of Davao del Sur Seal"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 p-0.5 border border-white/20 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition">
                                        <img
                                            src="/images/pmo.jpeg"
                                            alt="OPPMO Seal"
                                            className="w-full h-full object-contain rounded-full"
                                        />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-extrabold text-xs sm:text-sm tracking-wide text-white leading-tight truncate">
                                        <span className="hidden xs:inline sm:inline">E-PROCUREMENT </span>PPMP/APP SYSTEM
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] text-blue-300 font-semibold tracking-wider truncate uppercase">
                                        PROVINCE OF DAVAO DEL SUR
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Notifications & User Profile */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                            {/* Notification Bell */}
                            <div className="relative" ref={notifContainerRef}>
                                <button
                                    onClick={() => {
                                        const nextState = !showNotifMenu;
                                        setShowNotifMenu(nextState);
                                        if (nextState) {
                                            loadNotifications(true);
                                        }
                                    }}
                                    className="p-1.5 sm:p-2 text-slate-300 hover:text-white relative rounded-full hover:bg-slate-800 transition"
                                >
                                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 text-white rounded-full text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notification Dropdown Popover */}
                                {showNotifMenu && (
                                    <div 
                                        ref={notifDropdownRef}
                                        className="absolute right-0 mt-2 w-[340px] sm:w-[420px] md:w-[450px] max-h-[520px] flex flex-col bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95"
                                    >
                                        {/* Dropdown Header (Sticky Pinned) */}
                                        <div className="shrink-0 p-3.5 sm:p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-slate-800 shadow-xs">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-blue-500/15 text-blue-400 rounded-lg border border-blue-500/25">
                                                    <Bell className="w-4 h-4" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-xs uppercase tracking-wide">Notifications</span>
                                                    {unreadCount > 0 && (
                                                        <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black rounded-full shadow-xs animate-pulse">
                                                            {unreadCount} new
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        loadNotifications(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                                    title="Reload notification data"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingNotifs ? 'animate-spin text-blue-400' : ''}`} />
                                                </button>
                                            </div>
                                            {unreadCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={handleMarkAllRead}
                                                    className="px-2.5 py-1 text-[11px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                                                    title="Mark all notifications as read"
                                                >
                                                    <CheckCheck className="w-3 h-3" />
                                                    <span>Mark all read</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Body: Notification List (ONLY THIS SCROLLS) */}
                                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2.5 bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 scrollbar-track-transparent">
                                            {notifications.length === 0 ? (
                                                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                                                    <Bell className="w-7 h-7 text-slate-300" />
                                                    <span className="text-xs font-semibold text-slate-600">No notifications yet</span>
                                                    <span className="text-[11px] text-slate-400">Your recent alerts will appear here.</span>
                                                </div>
                                            ) : (
                                                notifications.map((n) => {
                                                    const hasShortcut = Boolean(n.ppmp?.uuid);
                                                    const isUnread = !n.read_at;

                                                    // Category badge calculation
                                                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                                                    let badgeIcon = <Info className="w-2.5 h-2.5 text-slate-500" />;
                                                    let categoryLabel = 'Notice';

                                                    if (n.type === 'success' || (n.title && (n.title.toLowerCase().includes('approved') || n.title.toLowerCase().includes('ready to print')))) {
                                                        badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                                        badgeIcon = <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />;
                                                        categoryLabel = 'Approved';
                                                    } else if (n.type === 'danger' || n.type === 'warning' || (n.title && (n.title.toLowerCase().includes('returned') || n.title.toLowerCase().includes('suspended') || n.title.toLowerCase().includes('remarks')))) {
                                                        badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
                                                        badgeIcon = <RotateCcw className="w-2.5 h-2.5 text-rose-600" />;
                                                        categoryLabel = 'Returned';
                                                    } else if (n.title && (n.title.toLowerCase().includes('review') || n.title.toLowerCase().includes('awaiting'))) {
                                                        badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                                                        badgeIcon = <Clock className="w-2.5 h-2.5 text-blue-600" />;
                                                        categoryLabel = 'In Review';
                                                    }

                                                    return (
                                                        <div
                                                            key={n.id}
                                                            onClick={() => handleNotificationClick(n)}
                                                            className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer group relative flex flex-col gap-2 shadow-2xs hover:shadow-md ${
                                                                isUnread
                                                                    ? 'bg-blue-50/50 hover:bg-blue-50/80 border-blue-300/80 border-l-4 border-l-blue-600'
                                                                    : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {/* Card Header */}
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeColor}`}>
                                                                        {badgeIcon}
                                                                        <span>{categoryLabel}</span>
                                                                    </span>
                                                                    {isUnread && (
                                                                        <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider rounded-sm shadow-2xs">
                                                                            NEW
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {n.created_at && (
                                                                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                                                                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                                                                            {formatTimeAgo(n.created_at)}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleDismissNotification(e, n.id)}
                                                                        title="Dismiss notification"
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition ml-0.5 cursor-pointer"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Card Title */}
                                                            <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition leading-snug">
                                                                {n.title}
                                                            </h4>

                                                            {/* Card Message */}
                                                            <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-3">
                                                                {n.message ? (n.ppmp?.tracking_number ? n.message.replace(/PPMP\s+0(?!\d)/g, `PPMP ${n.ppmp.tracking_number}`) : n.message) : ''}
                                                            </p>

                                                            {/* Card Footer */}
                                                            <div className="mt-0.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-400 font-mono">
                                                                    {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                                </span>

                                                                {hasShortcut && (
                                                                    <div className="inline-flex items-center gap-1 font-bold text-blue-600 group-hover:underline">
                                                                        <span>Open PPMP</span>
                                                                        <ArrowUpRight className="w-3 h-3" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* Dropdown Footer (Sticky Pinned) */}
                                        <div className="shrink-0 p-2.5 bg-white border-t border-slate-200 text-center">
                                            <button
                                                type="button"
                                                onClick={handleOpenAllNotifsDrawer}
                                                className="w-full py-2 px-3 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/50 hover:bg-blue-50 border border-blue-200/80 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                            >
                                                <span>See all notifications (Feed Drawer)</span>
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* User Profile info button */}
                            <button
                                type="button"
                                onClick={handleOpenProfile}
                                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer text-left group"
                                title="Click to view & edit your profile details or signature"
                            >
                                <UserAvatar
                                    user={user}
                                    size="sm"
                                    timestamp={photoTimestamp}
                                    canExpand={false}
                                    className="rounded-lg shadow-xs border border-blue-400/30 group-hover:scale-105 transition shrink-0"
                                />
                                <div className="hidden sm:flex flex-col text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <span className="font-bold text-xs text-white leading-tight group-hover:text-blue-200 transition">
                                            {user?.name}
                                        </span>
                                        {!user?.signature_path && (
                                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="No signature registered yet" />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider">
                                        {getRoleDisplayName(user?.role)}
                                    </span>
                                </div>
                            </button>

                            {/* Logout button */}
                            <button
                                onClick={onLogout}
                                title="Sign Out"
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-nav Links */}
                <nav className="bg-slate-800 border-t border-slate-700 hidden md:block relative z-30 overflow-visible">
                    <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-11 overflow-visible">
                        {/* Tab Buttons (Horizontal scrollable if cramped, isolated from dropdown) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap py-1 min-w-0">
                            <button
                                onClick={() => onNavigate('dashboard')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                                    activeTab === 'dashboard'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </button>

                            <button
                                onClick={() => onNavigate('ppmps')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                                    activeTab === 'ppmps' || activeTab === 'detail' || activeTab === 'edit'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                }`}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                PPMP Management List
                            </button>

                            {user?.role === 'end_user' && (
                                <button
                                    onClick={() => onNavigate('create')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                                        activeTab === 'create'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-emerald-300 hover:text-emerald-100 hover:bg-slate-700'
                                    }`}
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Prepare New PPMP
                                </button>
                            )}
                        </div>

                        {/* System Switcher Dropdown (outside of scroll container, always overflow-visible) */}
                        <div className="ml-4 flex items-center gap-2 shrink-0 relative z-40 overflow-visible">
                            <SystemSwitcherDropdown
                                user={user}
                                currentSystem="ppmp"
                                onNavigate={onNavigate}
                            />
                        </div>
                    </div>
                </nav>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-800 border-t border-slate-700 p-4 space-y-2">
                        <button
                            onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded ${
                                activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => { onNavigate('ppmps'); setMobileMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded ${
                                activeTab === 'ppmps' || activeTab === 'detail' || activeTab === 'edit' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            PPMP Management List
                        </button>
                        {user?.role === 'end_user' && (
                            <button
                                onClick={() => { onNavigate('create'); setMobileMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-slate-700 rounded"
                            >
                                Prepare New PPMP
                            </button>
                        )}
                        <div className="pt-2 border-t border-slate-700">
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 px-3">
                                Switch System
                            </div>
                            <div className="px-3 py-1">
                                <SystemSwitcherDropdown
                                    user={user}
                                    currentSystem="ppmp"
                                    onNavigate={(view) => {
                                        onNavigate(view);
                                        setMobileMenuOpen(false);
                                    }}
                                    align="left"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Office Context Banner */}
            <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 shadow-2xs no-print">
                <div className="max-w-[1700px] w-full mx-auto flex items-center justify-between text-xs text-slate-600 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800 text-[11px] sm:text-xs truncate">
                            {user?.office?.name || 'Provincial Government of Davao del Sur'}
                        </span>
                        {user?.office?.code && (
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[9px] sm:text-[10px] shrink-0">
                                {user.office.code}
                            </span>
                        )}
                    </div>
                    <div className="hidden sm:block text-[11px] text-slate-500 shrink-0">
                        Designation: <span className="font-medium text-slate-800">{user?.designation || 'Specialist'}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Body */}
            <main className="flex-1 max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 no-print">
                Province of Davao del Sur - OPPMO • Integrated E-Procurement & PPMP Management System
            </footer>

            {/* User Profile Details & Signature Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Header (Sticky top) */}
                        <div className="px-5 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    user={user}
                                    size="sm"
                                    timestamp={photoTimestamp}
                                    canExpand={false}
                                    className="rounded-xl shadow-xs border border-white/20"
                                />
                                <div>
                                    <h3 className="font-bold text-sm tracking-wide">User Profile &amp; Official Signature</h3>
                                    <p className="text-[11px] text-blue-300">View and update your account details and registered signature</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsProfileModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Status Feedback Messages (Sticky below header) */}
                        {profileError && (
                            <div className="mx-5 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{profileError}</span>
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="mx-5 sm:mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shrink-0">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>{profileSuccess}</span>
                            </div>
                        )}

                        {/* Form (Wraps scrollable body and sticky footer) */}
                        <form onSubmit={handleSaveProfile} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* Scrollable Form Body */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                                {/* Profile Photo & Avatar Section */}
                                <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                    <div className="relative group shrink-0">
                                        {photoPreviewUrl ? (
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-blue-500 shadow-md">
                                                <img
                                                    src={photoPreviewUrl}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : removePhotoRequested ? (
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-md border-2 border-slate-200">
                                                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                        ) : (
                                            <UserAvatar
                                                user={user}
                                                size="xl"
                                                timestamp={photoTimestamp}
                                                canExpand={true}
                                                className="shadow-md border-2 border-slate-200 cursor-pointer w-16 h-16 sm:w-20 sm:h-20"
                                            />
                                        )}
                                    </div>

                                    <div className="flex-1 text-center sm:text-left space-y-1">
                                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                                Profile Photo
                                            </span>
                                            <span className="text-[10px] font-semibold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                                                JPEG, PNG only (Max 2MB)
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Profile image is securely stored in protected storage and displayed across PPMP reviewer assignments. Click thumbnail to expand in full size.
                                        </p>

                                        {isEditingProfile && (
                                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                                <input
                                                    ref={photoFileInputRef}
                                                    type="file"
                                                    accept="image/jpeg,image/png"
                                                    onChange={handlePhotoFileChange}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => photoFileInputRef.current?.click()}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                                                >
                                                    <Camera className="w-3.5 h-3.5" />
                                                    <span>{user?.profile_photo_path || photoPreviewUrl ? 'Change Photo' : 'Upload Photo'}</span>
                                                </button>

                                                {(user?.profile_photo_path || photoPreviewUrl) && !removePhotoRequested && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemovePhoto}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span>Remove</span>
                                                    </button>
                                                )}

                                                {photoPreviewUrl && (
                                                    <span className="text-[11px] text-blue-600 font-semibold italic">
                                                        New photo selected (will save on submit)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Form Fields Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="text"
                                                required
                                                disabled={!isEditingProfile}
                                                value={profileForm.name || ''}
                                                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-600 bg-white text-slate-800"
                                                placeholder="Your full name"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="email"
                                                disabled
                                                value={user?.email || ''}
                                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl cursor-not-allowed"
                                                title="Email address cannot be modified self-service."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Phone Number
                                        </label>
                                        <div className="relative">
                                            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="tel"
                                                disabled={!isEditingProfile}
                                                value={profileForm.phone_number || ''}
                                                onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                                                placeholder="e.g. 0912 345 6789"
                                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-600 bg-white text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Position / Designation
                                        </label>
                                        <input
                                            type="text"
                                            disabled={!isEditingProfile}
                                            value={profileForm.designation || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                                            placeholder="e.g. Administrative Officer IV"
                                            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-600 bg-white text-slate-800"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            System Role
                                        </label>
                                        <div className="relative">
                                            <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="text"
                                                disabled
                                                value={getRoleDisplayName(user?.role) || ''}
                                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl cursor-not-allowed font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Assigned Office / Unit
                                        </label>
                                        <div className="relative">
                                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                            <input
                                                type="text"
                                                disabled
                                                value={user?.office?.name || 'Provincial Government of Davao del Sur'}
                                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl cursor-not-allowed truncate font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        User Address
                                    </label>
                                    <div className="relative">
                                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                        <input
                                            type="text"
                                            disabled={!isEditingProfile}
                                            value={profileForm.address || ''}
                                            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                                            placeholder="e.g. Digos City, Davao del Sur"
                                            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-600 bg-white text-slate-800"
                                        />
                                    </div>
                                </div>

                                {/* Official E-Signature Section */}
                                <div className="p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <PenTool className="w-4 h-4 text-blue-600" />
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                                Official Electronic Signature
                                            </span>
                                        </div>

                                        {user?.signature_path ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                <Check className="w-3 h-3" /> Signature on File
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                <AlertCircle className="w-3 h-3" /> No Signature Yet
                                            </span>
                                        )}
                                    </div>

                                    {/* Preview of existing signature on file */}
                                    {user?.signature_path && (!isEditingProfile || !showSignaturePad) && (
                                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center space-y-1.5">
                                            <img
                                                src={`${authService.getSignatureUrl()}?t=${signatureTimestamp}`}
                                                alt="Official Signature"
                                                className="max-h-16 max-w-full object-contain filter contrast-125"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                            <div className="flex items-center justify-between w-full pt-1.5 border-t border-slate-100 text-[10px]">
                                                <span className="text-slate-400">Stored securely in private storage</span>
                                                {isEditingProfile && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowSignaturePad(true);
                                                            setTimeout(clearCanvas, 50);
                                                        }}
                                                        className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                        Change Signature
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Signature drawing pad (when editing and user has no signature or clicked change signature) */}
                                    {isEditingProfile && (!user?.signature_path || showSignaturePad) && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-slate-700">
                                                    {user?.signature_path ? 'New Official Signature:' : 'Official Specimen Signature:'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSignatureModalOpen(true)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition shadow-xs active:scale-95"
                                                    >
                                                        <Maximize2 className="w-3 h-3" />
                                                        {hasProfileSignatureDrawn ? 'Edit Signature' : 'Draw Freely'}
                                                    </button>
                                                    {user?.signature_path && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowSignaturePad(false);
                                                                clearCanvas();
                                                            }}
                                                            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition"
                                                        >
                                                            Keep Current
                                                        </button>
                                                    )}
                                                    {hasProfileSignatureDrawn && (
                                                        <button
                                                            type="button"
                                                            onClick={clearCanvas}
                                                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition"
                                                            title="Clear drawing"
                                                        >
                                                            <Eraser className="w-3 h-3" />
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Clickable Card to open Modal */}
                                            <div 
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setIsSignatureModalOpen(true)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setIsSignatureModalOpen(true);
                                                    }
                                                }}
                                                className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white overflow-hidden shadow-inner group transition-all duration-200 cursor-pointer h-[100px] flex items-center justify-center select-none"
                                            >
                                                {hasProfileSignatureDrawn && profileSigDataUrl ? (
                                                    <div className="w-full h-full p-2 flex flex-col items-center justify-center relative group-hover:bg-blue-50/30 transition">
                                                        <img
                                                            src={profileSigDataUrl}
                                                            alt="Captured profile signature"
                                                            className="max-h-full max-w-full object-contain filter contrast-125 drop-shadow-sm"
                                                        />
                                                        <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[0.5px]">
                                                            <span className="px-3 py-1 bg-white/90 text-slate-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1">
                                                                <PenTool className="w-3 h-3 text-blue-600" /> Click to Redraw / Edit
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 p-3 transition-colors text-center">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-1 transition-colors shadow-xs group-hover:scale-105">
                                                            <PenTool className="w-4 h-4 stroke-[1.75]" />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                                                            Click here to open Signature Studio
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 group-hover:text-slate-500 mt-0.5">
                                                            Draw freely with high resolution smooth curves and undo
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                <span>Sign on baseline. Encrypted securely.</span>
                                                {hasProfileSignatureDrawn ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> New signature ready
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsSignatureModalOpen(true)}
                                                            className="text-[10px] text-blue-600 font-semibold hover:underline cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                ) : (
                                                    user?.signature_path && (
                                                        <span className="text-amber-600">Leave blank to keep existing signature</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer Controls (Sticky at bottom, never overflow) */}
                            <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                                {!isEditingProfile ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsProfileModalOpen(false)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setProfileSuccess('');
                                                setProfileError('');
                                                setIsEditingProfile(true);
                                                setShowSignaturePad(!user?.signature_path);
                                            }}
                                            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>Edit Details</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            disabled={profileSaving}
                                            onClick={() => {
                                                setIsEditingProfile(false);
                                                setShowSignaturePad(false);
                                                clearCanvas();
                                                // Reset form back to user's saved data
                                                setProfileForm({
                                                    name: user?.name || '',
                                                    phone_number: user?.phone_number || '',
                                                    address: user?.address || '',
                                                    designation: user?.designation || '',
                                                });
                                                setPhotoPreviewUrl(null);
                                                setSelectedPhotoFile(null);
                                                setRemovePhotoRequested(false);
                                            }}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={profileSaving}
                                            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                                        >
                                            {profileSaving ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Saving Changes...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-3.5 h-3.5" />
                                                    <span>Save Changes</span>
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Profile Freeform Signature Drawing Studio Modal */}
            <SignaturePadModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleApplyProfileModalSignature}
                initialDataUrl={profileSigDataUrl || (user?.signature_path ? `${authService.getSignatureUrl()}?t=${signatureTimestamp}` : null)}
                title="Draw Official Specimen Signature"
                description="Freely draw and adjust your official signature with high-resolution smooth bezier curves, thickness settings, and ink colors."
            />

            {/* Slide Pop-up Side Drawer: All Notifications */}
            {showAllNotifsDrawer && (
                <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="notif-drawer-title">
                    {/* Backdrop */}
                    <div 
                        onClick={() => setShowAllNotifsDrawer(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                    />

                    {/* Side Sliding Drawer */}
                    <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 h-full pointer-events-none">
                        <div className="w-screen max-w-md sm:max-w-lg lg:max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full max-h-screen overflow-hidden pointer-events-auto animate-in slide-in-from-right duration-250">
                            {/* Drawer Header (STICKY PINNED AT TOP) */}
                            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-b border-slate-800 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shadow-xs shrink-0">
                                            <Bell className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 id="notif-drawer-title" className="font-extrabold text-sm sm:text-base uppercase tracking-wide truncate">
                                                    All Notifications
                                                </h3>
                                                {unreadCount > 0 && (
                                                    <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black rounded-full shadow-xs animate-pulse shrink-0">
                                                        {unreadCount} new
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 truncate">
                                                Activity feed &amp; document status tracking
                                            </p>
                                        </div>
                                    </div>

                                    {/* Top Quick Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleOpenAllNotifsDrawer}
                                            disabled={loadingAllNotifs}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                                            title="Reload all notifications"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${loadingAllNotifs ? 'animate-spin text-blue-400' : ''}`} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAllNotifsDrawer(false)}
                                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                                            title="Close side drawer (Esc)"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Header Action Toolbar */}
                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                                    <span className="text-[11px] font-medium text-slate-400">
                                        {(allNotifications.length > 0 ? allNotifications : notifications).length} Total Alerts in Feed
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleMarkAllRead}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                                                title="Mark all notifications as read"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5" />
                                                <span>Mark all read</span>
                                            </button>
                                        )}
                                        {(allNotifications.length > 0 || notifications.length > 0) && (
                                            <button
                                                type="button"
                                                onClick={handleClearAllNotifications}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 border border-rose-500/30 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                                                title="Clear all notifications"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                <span>Clear all</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sub-Header: Search & Category Filter Pills (STICKY PINNED) */}
                            {(() => {
                                const sourceList = allNotifications.length > 0 ? allNotifications : notifications;
                                const unreadListCount = sourceList.filter(n => !n.read_at).length;
                                const approvedCount = sourceList.filter(n => n.type === 'success' || (n.title && (n.title.toLowerCase().includes('approved') || n.title.toLowerCase().includes('ready to print')))).length;
                                const reviewCount = sourceList.filter(n => n.title && (n.title.toLowerCase().includes('review') || n.title.toLowerCase().includes('awaiting'))).length;
                                const returnedCount = sourceList.filter(n => n.type === 'danger' || n.type === 'warning' || (n.title && (n.title.toLowerCase().includes('returned') || n.title.toLowerCase().includes('suspended') || n.title.toLowerCase().includes('remarks')))).length;

                                return (
                                    <div className="shrink-0 p-3 bg-white border-b border-slate-200/90 shadow-2xs space-y-2.5">
                                        {/* Search Filter Input */}
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={notifSearch}
                                                onChange={(e) => setNotifSearch(e.target.value)}
                                                placeholder="Search by title, tracker no, or message..."
                                                className="w-full text-xs pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition placeholder:text-slate-400"
                                            />
                                            {notifSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNotifSearch('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                                    title="Clear search"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Filter Tabs */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                                            {[
                                                { key: 'all', label: 'All', count: sourceList.length },
                                                { key: 'unread', label: 'Unread', count: unreadListCount, badgeClass: unreadListCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700' },
                                                { key: 'approved', label: 'Approved', count: approvedCount, badgeClass: 'bg-emerald-100 text-emerald-800' },
                                                { key: 'review', label: 'In Review', count: reviewCount, badgeClass: 'bg-indigo-100 text-indigo-800' },
                                                { key: 'returned', label: 'Returned', count: returnedCount, badgeClass: returnedCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700' },
                                            ].map((tab) => {
                                                const isActive = notifFilter === tab.key;
                                                return (
                                                    <button
                                                        key={tab.key}
                                                        type="button"
                                                        onClick={() => setNotifFilter(tab.key)}
                                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                                                            isActive
                                                                ? 'bg-slate-900 text-white shadow-xs'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                        }`}
                                                    >
                                                        <span>{tab.label}</span>
                                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                            isActive ? 'bg-white/20 text-white' : tab.badgeClass
                                                        }`}>
                                                            {tab.count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Drawer Body: Notification List (ONLY THIS SCROLLS!) */}
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 scrollbar-track-transparent">
                                {loadingAllNotifs ? (
                                    <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500 gap-3">
                                        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                                        <span className="text-xs font-semibold text-slate-600">Loading all notifications...</span>
                                    </div>
                                ) : (() => {
                                    const sourceList = allNotifications.length > 0 ? allNotifications : notifications;
                                    
                                    const filteredList = sourceList.filter((n) => {
                                        // 1. Tab filter
                                        if (notifFilter === 'unread' && n.read_at) return false;
                                        if (notifFilter === 'approved') {
                                            const isAppr = n.type === 'success' || (n.title && (n.title.toLowerCase().includes('approved') || n.title.toLowerCase().includes('ready to print')));
                                            if (!isAppr) return false;
                                        }
                                        if (notifFilter === 'review') {
                                            const isRev = n.title && (n.title.toLowerCase().includes('review') || n.title.toLowerCase().includes('awaiting'));
                                            if (!isRev) return false;
                                        }
                                        if (notifFilter === 'returned') {
                                            const isRet = n.type === 'danger' || n.type === 'warning' || (n.title && (n.title.toLowerCase().includes('returned') || n.title.toLowerCase().includes('suspended') || n.title.toLowerCase().includes('remarks')));
                                            if (!isRet) return false;
                                        }

                                        // 2. Search query filter
                                        if (notifSearch.trim()) {
                                            const q = notifSearch.toLowerCase();
                                            const title = (n.title || '').toLowerCase();
                                            const msg = (n.message || '').toLowerCase();
                                            const tracker = (n.ppmp?.tracking_number || '').toLowerCase();
                                            if (!title.includes(q) && !msg.includes(q) && !tracker.includes(q)) {
                                                return false;
                                            }
                                        }

                                        return true;
                                    });

                                    if (sourceList.length === 0) {
                                        return (
                                            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                                                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                                                    <Bell className="w-8 h-8 text-slate-300" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">No notifications found</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">Your official activity history is currently clear.</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (filteredList.length === 0) {
                                        return (
                                            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                                                <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                                                    <Search className="w-6 h-6 text-slate-300" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">No matching notifications</p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search or switching to another category tab.</p>
                                                </div>
                                                {(notifSearch || notifFilter !== 'all') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNotifSearch('');
                                                            setNotifFilter('all');
                                                        }}
                                                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                                                    >
                                                        Reset Filters
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }

                                    return filteredList.map((n) => {
                                        const hasShortcut = Boolean(n.ppmp?.uuid);
                                        const isUnread = !n.read_at;

                                        // Category badge calculation
                                        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                                        let badgeIcon = <Info className="w-3 h-3 text-slate-500" />;
                                        let categoryLabel = 'Notice';

                                        if (n.type === 'success' || (n.title && (n.title.toLowerCase().includes('approved') || n.title.toLowerCase().includes('ready to print')))) {
                                            badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                            badgeIcon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
                                            categoryLabel = 'Approved';
                                        } else if (n.type === 'danger' || n.type === 'warning' || (n.title && (n.title.toLowerCase().includes('returned') || n.title.toLowerCase().includes('suspended') || n.title.toLowerCase().includes('remarks')))) {
                                            badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
                                            badgeIcon = <RotateCcw className="w-3 h-3 text-rose-600" />;
                                            categoryLabel = 'Returned / Remarks';
                                        } else if (n.title && (n.title.toLowerCase().includes('review') || n.title.toLowerCase().includes('awaiting'))) {
                                            badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                                            badgeIcon = <Clock className="w-3 h-3 text-blue-600" />;
                                            categoryLabel = 'Review Pipeline';
                                        }

                                        return (
                                            <div
                                                key={n.id}
                                                onClick={() => handleNotificationClick(n)}
                                                className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer group relative flex flex-col gap-2.5 shadow-2xs hover:shadow-md ${
                                                    isUnread
                                                        ? 'bg-blue-50/45 hover:bg-blue-50/80 border-blue-300/80 border-l-4 border-l-blue-600'
                                                        : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300'
                                                }`}
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                                                            {badgeIcon}
                                                            <span>{categoryLabel}</span>
                                                        </span>

                                                        {isUnread && (
                                                            <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider rounded-sm shadow-2xs">
                                                                NEW
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {n.created_at && (
                                                            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                {formatTimeAgo(n.created_at)}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDismissNotification(e, n.id)}
                                                            title="Dismiss notification"
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition ml-1 cursor-pointer"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Card Title */}
                                                <h4 className="font-extrabold text-[13px] text-slate-900 group-hover:text-blue-600 transition leading-snug">
                                                    {n.title}
                                                </h4>

                                                {/* Card Message */}
                                                <p className="text-slate-600 text-xs leading-relaxed">
                                                    {n.message ? (n.ppmp?.tracking_number ? n.message.replace(/PPMP\s+0(?!\d)/g, `PPMP ${n.ppmp.tracking_number}`) : n.message) : ''}
                                                </p>

                                                {/* Card Action & Timestamp Footer */}
                                                <div className="mt-1 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] flex-wrap gap-2">
                                                    <span className="text-slate-400 font-mono text-[10px]">
                                                        {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                                                    </span>

                                                    {hasShortcut && (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white rounded-lg font-bold text-xs transition border border-blue-200 group-hover:border-blue-600 shadow-2xs">
                                                            <span>Open PPMP Details</span>
                                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Drawer Footer (STICKY PINNED AT BOTTOM) */}
                            <div className="shrink-0 p-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                                <span>Official System Activity &amp; Status Tracking</span>
                                <button
                                    type="button"
                                    onClick={() => setShowAllNotifsDrawer(false)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition cursor-pointer text-xs flex items-center gap-1"
                                >
                                    <span>Close</span>
                                    <span className="text-[10px] text-slate-400 font-mono">(Esc)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receive Required Modal for Notifications */}
            {receiveRequiredPpmp && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                                <Inbox className="w-6 h-6" />
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                                Document Receipt Required
                            </h3>
                            <p className="text-xs text-slate-500 text-center mb-4">
                                Tracking No: <span className="font-semibold text-slate-800">{receiveRequiredPpmp.tracking_number || receiveRequiredPpmp.ppmp_number || 'N/A'}</span>
                            </p>

                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 mb-5 text-xs text-emerald-900 leading-relaxed">
                                <p className="font-semibold mb-1 flex items-center gap-1.5 text-emerald-800">
                                    <Shield className="w-4 h-4 text-emerald-600" />
                                    <span>Official Protocol</span>
                                </p>
                                <p>
                                    As part of official workflow tracking, you must acknowledge <strong>Receipt</strong> of this PPMP before accessing its details.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setReceiveRequiredPpmp(null)}
                                    disabled={receivingNotifPpmp}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReceiveFromModal}
                                    disabled={receivingNotifPpmp}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {receivingNotifPpmp ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Receiving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Inbox className="w-4 h-4" />
                                            <span>Receive Document</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
