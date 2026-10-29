import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { authService, dashboardService, ppmpService } from './services/api';
import { MainLayout } from './components/Layout/MainLayout';
import { LoginPage } from './pages/Auth/LoginPage';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { PPMPListPage } from './pages/PPMP/PPMPListPage';
import { PPMPDetailPage } from './pages/PPMP/PPMPDetailPage';
import { PPMPFormPage } from './pages/PPMP/PPMPFormPage';
import { PrivacyPolicyPage } from './pages/Privacy/PrivacyPolicyPage';
import { MonitoringDashboard } from './pages/Monitoring/MonitoringDashboard';
import { SupplierEvaluationDashboard } from './pages/SupplierEvaluation/SupplierEvaluationDashboard';
import { SourceOfFundModal, FUND_SOURCES } from './components/PPMP/SourceOfFundModal';
import { initDevToolsGuard } from './utils/devToolsGuard';
import { Loader2 } from 'lucide-react';
import { LandingPage } from './pages/Landing/LandingPage';
import { UnauthorizedSystemAccessView, canUserAccessSystem } from './components/UI/UnauthorizedSystemAccessView';

const ROUTE_STORAGE_KEY = 'eproc_active_route';
const LAST_ACTIVE_SYSTEM_KEY = 'eproc_last_active_system';
const DASHBOARD_PATH = '/eprocrementppmpapp';

/**
 * Determine initial last active system from sessionStorage or initial pathname
 */
const getInitialLastActiveSystem = () => {
    try {
        const stored = sessionStorage.getItem(LAST_ACTIVE_SYSTEM_KEY);
        if (stored && ['dashboard', 'monitoring', 'supplierevaluation'].includes(stored)) {
            return stored;
        }
    } catch (_) {}

    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/monitoringsystem' || path.startsWith('/monitoring')) return 'monitoring';
    if (path === '/supplierevaluation' || path.startsWith('/supplier-evaluation')) return 'supplierevaluation';
    return 'dashboard';
};

/**
 * Parse current browser URL pathname or fallback to sessionStorage route
 */
const parseRouteFromLocation = () => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';

    if (path === '/privacy') {
        return { view: 'privacy', uuid: null };
    }
    if (path === '/monitoringsystem' || path.startsWith('/monitoring')) {
        return { view: 'monitoring', uuid: null };
    }
    if (path === '/supplierevaluation' || path.startsWith('/supplier-evaluation')) {
        return { view: 'supplierevaluation', uuid: null };
    }
    if (path === '/ppmps/create') {
        return { view: 'create', uuid: null };
    }

    const editMatch = path.match(/^\/ppmps\/([a-zA-Z0-9_-]+)\/edit$/);
    if (editMatch) {
        return { view: 'edit', uuid: editMatch[1] };
    }

    const detailMatch = path.match(/^\/ppmps\/([a-zA-Z0-9_-]+)$/);
    if (detailMatch) {
        return { view: 'detail', uuid: detailMatch[1] };
    }

    if (path === '/ppmps') {
        return { view: 'ppmps', uuid: null };
    }

    if (path === '/eprocrementppmpapp' || path === '/eprocurementppmpapp' || path === '/dashboard') {
        return { view: 'dashboard', uuid: null };
    }

    if (path === '/login') {
        return { view: 'login', uuid: null };
    }

    if (path === '/' || path === '/home') {
        return { view: 'landing', uuid: null };
    }

    // Defensive fallback: check sessionStorage
    try {
        const saved = sessionStorage.getItem(ROUTE_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed.view === 'string') {
                if (parsed.view === 'landing') {
                    return { view: 'landing', uuid: null };
                }
                if (parsed.view === 'ppmps') {
                    return { view: 'ppmps', uuid: null };
                }
                if ((parsed.view === 'detail' || parsed.view === 'edit') && parsed.uuid) {
                    return { view: parsed.view, uuid: parsed.uuid };
                }
                if (parsed.view === 'dashboard') {
                    return { view: 'dashboard', uuid: null };
                }
                if (parsed.view === 'supplierevaluation') {
                    return { view: 'supplierevaluation', uuid: null };
                }
            }
        }
    } catch (_) {}

    return { view: 'landing', uuid: null };
};

/**
 * Synchronize browser URL and sessionStorage with current navigation state
 */
const syncUrlAndState = (view, uuid = null, replace = false) => {
    let targetPath = '/';
    if (view === 'landing') {
        targetPath = '/';
    } else if (view === 'dashboard' || view === 'login') {
        targetPath = DASHBOARD_PATH;
    } else if (view === 'ppmps') {
        targetPath = '/ppmps';
    } else if (view === 'detail' && uuid) {
        targetPath = `/ppmps/${uuid}`;
    } else if (view === 'edit' && uuid) {
        targetPath = `/ppmps/${uuid}/edit`;
    } else if (view === 'create') {
        targetPath = '/ppmps/create';
    } else if (view === 'privacy') {
        targetPath = '/privacy';
    } else if (view === 'monitoring') {
        targetPath = '/monitoringsystem';
    } else if (view === 'supplierevaluation') {
        targetPath = '/supplierevaluation';
    } else {
        targetPath = '/';
    }

    if (window.location.pathname !== targetPath) {
        if (replace) {
            window.history.replaceState({ view, uuid }, '', targetPath);
        } else {
            window.history.pushState({ view, uuid }, '', targetPath);
        }
    }

    try {
        sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify({ view, uuid }));
    } catch (_) {}
};

export function App() {
    const initialRoute = parseRouteFromLocation();

    const [user, setUser] = useState(() => window.App?.user || null);
    const [loading, setLoading] = useState(() => !window.App?.user && window.App !== undefined ? false : false);
    const [authErrorMessage, setAuthErrorMessage] = useState('');
    const [lastActiveSystem, setLastActiveSystem] = useState(getInitialLastActiveSystem);
    const [currentView, setCurrentView] = useState(() => {
        const route = initialRoute.view;
        const appUser = window.App?.user;
        if (appUser) {
            if (route === 'monitoring') return 'monitoring';
            if (route === 'supplierevaluation') return 'supplierevaluation';
            if (canUserAccessSystem(appUser, '/monitoringsystem') && !canUserAccessSystem(appUser, '/eprocrementppmpapp') && !canUserAccessSystem(appUser, '/supplierevaluation')) {
                return 'monitoring';
            }
            if (canUserAccessSystem(appUser, '/supplierevaluation') && !canUserAccessSystem(appUser, '/eprocrementppmpapp') && !canUserAccessSystem(appUser, '/monitoringsystem')) {
                return 'supplierevaluation';
            }
        }
        return route;
    }); // dashboard, ppmps, create, detail, edit, privacy, monitoring, supplierevaluation
    const [selectedPpmpUuid, setSelectedPpmpUuid] = useState(() => initialRoute.uuid || null);
    const [currentPpmp, setCurrentPpmp] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [selectedSourceOfFund, setSelectedSourceOfFund] = useState(FUND_SOURCES.GENERAL_FUND);
    const [isSourceOfFundModalOpen, setIsSourceOfFundModalOpen] = useState(false);

    // Check existing session if needed
    const checkAuth = async () => {
        // If server already told us user is not logged in, skip calling /api/me
        if (window.App && !window.App.user) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const res = await authService.getProfile();
            const profileUser = res.data.user;
            setUser(profileUser);
            const route = parseRouteFromLocation();
            if (route.view === 'monitoring' && canUserAccessSystem(profileUser, '/monitoringsystem')) {
                setLastActiveSystem('monitoring');
                try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'monitoring'); } catch (_) {}
                setCurrentView('monitoring');
                syncUrlAndState('monitoring', null, true);
            } else if (route.view === 'supplierevaluation' && canUserAccessSystem(profileUser, '/supplierevaluation')) {
                setLastActiveSystem('supplierevaluation');
                try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'supplierevaluation'); } catch (_) {}
                setCurrentView('supplierevaluation');
                syncUrlAndState('supplierevaluation', null, true);
            } else if (!canUserAccessSystem(profileUser, '/eprocrementppmpapp') && canUserAccessSystem(profileUser, '/monitoringsystem')) {
                setLastActiveSystem('monitoring');
                try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'monitoring'); } catch (_) {}
                setCurrentView('monitoring');
                syncUrlAndState('monitoring', null, true);
            } else if (!canUserAccessSystem(profileUser, '/eprocrementppmpapp') && canUserAccessSystem(profileUser, '/supplierevaluation')) {
                setLastActiveSystem('supplierevaluation');
                try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'supplierevaluation'); } catch (_) {}
                setCurrentView('supplierevaluation');
                syncUrlAndState('supplierevaluation', null, true);
            }
        } catch (e) {
            // Only clear user on actual 401 Unauthorized
            if (e.response?.status === 401) {
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadDashboard = async () => {
        try {
            const res = await dashboardService.getDashboard();
            setDashboardData(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadPpmpDetail = async (uuid, updateUrl = true) => {
        if (!uuid) return false;
        setSelectedPpmpUuid(uuid);
        setCurrentView('detail');
        if (updateUrl) {
            syncUrlAndState('detail', uuid, false);
        }
        try {
            const res = await ppmpService.getOne(uuid);
            const ppmpObj = res.data.ppmp;
            if (res.data.default_signatories) {
                ppmpObj.default_signatories = res.data.default_signatories;
            }
            setCurrentPpmp(ppmpObj);
            return true;
        } catch (e) {
            console.error('Failed to load PPMP details:', e);
            alert(e.response?.data?.message || 'Failed to load PPMP details.');
            handleNavigate('ppmps', null, false);
            return false;
        }
    };

    const handleNavigate = (view, targetUuid = null, pushHistory = true) => {
        if (view === 'landing') {
            syncUrlAndState('landing', null, !pushHistory);
            setCurrentView('landing');
            return;
        }
        if (view === 'monitoring') {
            syncUrlAndState('monitoring', null, !pushHistory);
            setCurrentView('monitoring');
            return;
        }
        if (view === 'supplierevaluation') {
            syncUrlAndState('supplierevaluation', null, !pushHistory);
            setCurrentView('supplierevaluation');
            return;
        }
        if (view === 'create') {
            setIsSourceOfFundModalOpen(true);
            return;
        }
        if (view === 'users') {
            syncUrlAndState('dashboard', null, false);
            setCurrentView('dashboard');
            loadDashboard();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('admin:navigate_section', { detail: { section: 'users' } }));
            }, 50);
            return;
        }

        if (view === 'detail') {
            const uuid = targetUuid || selectedPpmpUuid;
            if (uuid) {
                loadPpmpDetail(uuid, pushHistory);
                return;
            }
            view = 'ppmps';
        }

        if (view === 'edit') {
            const uuid = targetUuid || selectedPpmpUuid || currentPpmp?.uuid;
            if (uuid) {
                setSelectedPpmpUuid(uuid);
                setCurrentView('edit');
                syncUrlAndState('edit', uuid, !pushHistory);
                if (!currentPpmp || currentPpmp.uuid !== uuid) {
                    loadPpmpDetail(uuid, false);
                }
                return;
            }
            view = 'ppmps';
        }

        // Standard views: 'dashboard', 'ppmps'
        syncUrlAndState(view, null, !pushHistory);
        setCurrentView(view);
        if (view === 'dashboard') {
            loadDashboard();
        }
    };

    const handleSelectSourceOfFund = (fund) => {
        setSelectedSourceOfFund(fund);
        setIsSourceOfFundModalOpen(false);
        syncUrlAndState('create', null, false);
        setCurrentView('create');
    };

    const handleReturnToDashboard = () => {
        if (!user) {
            syncUrlAndState('dashboard', null, false);
            setCurrentView('login');
            return;
        }

        const hasPpmp = canUserAccessSystem(user, '/eprocrementppmpapp');
        const hasMonitoring = canUserAccessSystem(user, '/monitoringsystem');
        const hasSupplierEval = canUserAccessSystem(user, '/supplierevaluation');

        if (lastActiveSystem === 'supplierevaluation' && hasSupplierEval) {
            syncUrlAndState('supplierevaluation', null, false);
            setCurrentView('supplierevaluation');
            return;
        }

        if (lastActiveSystem === 'monitoring' && hasMonitoring) {
            syncUrlAndState('monitoring', null, false);
            setCurrentView('monitoring');
            return;
        }

        if (lastActiveSystem === 'dashboard' && hasPpmp) {
            handleNavigate('dashboard', null, false);
            return;
        }

        // Fallbacks based on access privileges
        if (hasPpmp) {
            handleNavigate('dashboard', null, false);
        } else if (hasSupplierEval) {
            syncUrlAndState('supplierevaluation', null, false);
            setCurrentView('supplierevaluation');
        } else if (hasMonitoring) {
            syncUrlAndState('monitoring', null, false);
            setCurrentView('monitoring');
        } else {
            handleNavigate('dashboard', null, false);
        }
    };

    // Track last active system to ensure returning from portal home routes to user's dashboard and system URL
    useEffect(() => {
        if (['dashboard', 'ppmps', 'create', 'edit', 'detail'].includes(currentView)) {
            setLastActiveSystem('dashboard');
            try {
                sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'dashboard');
            } catch (_) {}
        } else if (currentView === 'monitoring') {
            setLastActiveSystem('monitoring');
            try {
                sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'monitoring');
            } catch (_) {}
        } else if (currentView === 'supplierevaluation') {
            setLastActiveSystem('supplierevaluation');
            try {
                sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'supplierevaluation');
            } catch (_) {}
        }
    }, [currentView]);

    const userRef = React.useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Restore PPMP details or list state on initial load / refresh
    useEffect(() => {
        if (!user) return;
        if ((currentView === 'detail' || currentView === 'edit') && selectedPpmpUuid) {
            syncUrlAndState(currentView, selectedPpmpUuid, true);
            if (!currentPpmp || currentPpmp.uuid !== selectedPpmpUuid) {
                loadPpmpDetail(selectedPpmpUuid, false);
            }
        } else if (currentView === 'ppmps') {
            syncUrlAndState('ppmps', null, true);
        } else if (currentView === 'create') {
            syncUrlAndState('create', null, true);
        } else if (currentView === 'dashboard') {
            syncUrlAndState('dashboard', null, true);
        } else if (currentView === 'monitoring') {
            syncUrlAndState('monitoring', null, true);
        } else if (currentView === 'supplierevaluation') {
            syncUrlAndState('supplierevaluation', null, true);
        } else if (currentView === 'landing') {
            syncUrlAndState('landing', null, true);
        }
    }, [user?.id, currentView]);

    useEffect(() => {
        initDevToolsGuard();
        checkAuth();

        const handleUnauthorized = (e) => {
            const currentRoute = parseRouteFromLocation();
            setUser(null);
            if (currentRoute.view === 'supplierevaluation') {
                syncUrlAndState('supplierevaluation', null, true);
                setCurrentView('supplierevaluation');
            } else if (currentRoute.view === 'monitoring') {
                syncUrlAndState('monitoring', null, true);
                setCurrentView('monitoring');
            } else if (currentRoute.view === 'privacy') {
                syncUrlAndState('privacy', null, true);
                setCurrentView('privacy');
            } else if (currentRoute.view === 'landing') {
                syncUrlAndState('landing', null, true);
                setCurrentView('landing');
            } else {
                syncUrlAndState('dashboard', null, true);
                setCurrentView('dashboard');
            }
            if (e?.detail?.reason) {
                setAuthErrorMessage(e.detail.reason);
            }
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);

        const handleDevToolsUnauthorized = (e) => {
            const currentRoute = parseRouteFromLocation();
            if (e?.detail?.message) {
                setAuthErrorMessage(e.detail.message);
            }
            setUser(null);
            if (currentRoute.view === 'supplierevaluation') {
                syncUrlAndState('supplierevaluation', null, true);
                setCurrentView('supplierevaluation');
            } else if (currentRoute.view === 'monitoring') {
                syncUrlAndState('monitoring', null, true);
                setCurrentView('monitoring');
            } else if (currentRoute.view === 'privacy') {
                syncUrlAndState('privacy', null, true);
                setCurrentView('privacy');
            } else if (currentRoute.view === 'landing') {
                syncUrlAndState('landing', null, true);
                setCurrentView('landing');
            } else {
                syncUrlAndState('dashboard', null, true);
                setCurrentView('dashboard');
            }
        };
        window.addEventListener('devtools:unauthorized', handleDevToolsUnauthorized);

        const handlePopState = () => {
            const currentUser = userRef.current;
            const route = parseRouteFromLocation();

            if (route.view === 'landing') {
                setCurrentView('landing');
                return;
            }

            if (route.view === 'privacy') {
                setCurrentView('privacy');
                return;
            }

            if (route.view === 'monitoring') {
                setCurrentView('monitoring');
                return;
            }

            if (route.view === 'supplierevaluation') {
                setCurrentView('supplierevaluation');
                return;
            }

            setCurrentView(route.view);
            if (route.uuid) {
                setSelectedPpmpUuid(route.uuid);
                if (!currentPpmp || currentPpmp.uuid !== route.uuid) {
                    loadPpmpDetail(route.uuid, false);
                }
            } else {
                if (route.view !== 'detail' && route.view !== 'edit') {
                    setSelectedPpmpUuid(null);
                }
            }

            try {
                sessionStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
            } catch (_) {}
        };
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('devtools:unauthorized', handleDevToolsUnauthorized);
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        if (user.role === 'monitor' && currentView === 'dashboard' && !canUserAccessSystem(user, '/eprocrementppmpapp')) {
            setCurrentView('monitoring');
            syncUrlAndState('monitoring', null, true);
        }
    }, [user?.id, user?.role]);

    useEffect(() => {
        if (user && currentView === 'dashboard') {
            loadDashboard();
        }
    }, [user, currentView]);

    useEffect(() => {
        const handleDataReload = (e) => {
            if (!user) return;
            if (currentView === 'dashboard') {
                loadDashboard();
            } else if (currentView === 'detail' && selectedPpmpUuid) {
                if (!e?.detail?.ppmpUuid || e.detail.ppmpUuid === selectedPpmpUuid) {
                    loadPpmpDetail(selectedPpmpUuid, false);
                }
            }
        };
        window.addEventListener('app:data_reload', handleDataReload);
        return () => window.removeEventListener('app:data_reload', handleDataReload);
    }, [user, currentView, selectedPpmpUuid]);

    const handleLogout = async () => {
        const activeSystem = currentView;
        try {
            await authService.logout();
        } catch (e) {
            console.error(e);
        } finally {
            setUser(null);
            setCurrentPpmp(null);
            setSelectedPpmpUuid(null);
            if (window.App) window.App.user = null;

            // Retain the respective system URL so the user remains on their current system after logout
            if (activeSystem === 'supplierevaluation') {
                syncUrlAndState('supplierevaluation', null, true);
                setCurrentView('supplierevaluation');
            } else if (activeSystem === 'monitoring') {
                syncUrlAndState('monitoring', null, true);
                setCurrentView('monitoring');
            } else if (activeSystem === 'privacy') {
                syncUrlAndState('privacy', null, true);
                setCurrentView('privacy');
            } else if (activeSystem === 'landing') {
                syncUrlAndState('landing', null, true);
                setCurrentView('landing');
            } else {
                // E-Procurement PPMP & APP System views (dashboard, ppmps, detail, create, edit)
                syncUrlAndState('dashboard', null, true);
                setCurrentView('dashboard');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
                <div className="text-sm font-semibold tracking-wider uppercase">Loading Provincial System...</div>
            </div>
        );
    }

    if (currentView === 'landing') {
        return (
            <LandingPage
                user={user}
                onLaunchDashboard={handleReturnToDashboard}
                onLaunchEproc={() => {
                    if (user) {
                        handleNavigate('dashboard');
                    } else {
                        syncUrlAndState('dashboard', null, false);
                        setCurrentView('login');
                    }
                }}
                onLaunchMonitoring={() => {
                    if (user) {
                        handleNavigate('monitoring');
                    } else {
                        syncUrlAndState('monitoring', null, false);
                        setCurrentView('login');
                    }
                }}
                onOpenLogin={() => {
                    syncUrlAndState('dashboard', null, false);
                    setCurrentView('login');
                }}
                onOpenPrivacy={() => {
                    syncUrlAndState('privacy', null, false);
                    setCurrentView('privacy');
                }}
                onLaunchSystem={(sys) => {
                    const cleanPath = (sys?.link_url || '').replace(/\/+$/, '') || '/';
                    if (cleanPath === '/monitoringsystem' || cleanPath.startsWith('/monitoring')) {
                        if (user) {
                            handleNavigate('monitoring');
                        } else {
                            syncUrlAndState('monitoring', null, false);
                            setCurrentView('login');
                        }
                        return;
                    }
                    if (cleanPath === '/supplierevaluation' || cleanPath.startsWith('/supplier-evaluation')) {
                        if (user) {
                            handleNavigate('supplierevaluation');
                        } else {
                            syncUrlAndState('supplierevaluation', null, false);
                            setCurrentView('login');
                        }
                        return;
                    }
                    if (cleanPath === '/privacy') {
                        syncUrlAndState('privacy', null, false);
                        setCurrentView('privacy');
                        return;
                    }
                    if (cleanPath === '/ppmps') {
                        if (user) {
                            handleNavigate('ppmps');
                        } else {
                            syncUrlAndState('ppmps', null, false);
                            setCurrentView('login');
                        }
                        return;
                    }
                    if (cleanPath === '/ppmps/create') {
                        if (user) {
                            handleNavigate('create');
                        } else {
                            syncUrlAndState('create', null, false);
                            setCurrentView('login');
                        }
                        return;
                    }
                    if (user) {
                        handleNavigate('dashboard');
                    } else {
                        syncUrlAndState('dashboard', null, false);
                        setCurrentView('login');
                    }
                }}
            />
        );
    }

    if (currentView === 'privacy') {
        return (
            <PrivacyPolicyPage
                onBack={() => {
                    if (user) {
                        syncUrlAndState('dashboard', null, false);
                        setCurrentView('dashboard');
                    } else {
                        syncUrlAndState('landing', null, false);
                        setCurrentView('landing');
                    }
                }}
            />
        );
    }

    if (!user) {
        return (
            <LoginPage
                targetSystem={currentView}
                initialError={authErrorMessage}
                onBackToLanding={() => {
                    syncUrlAndState('landing', null, false);
                    setCurrentView('landing');
                }}
                onLoginSuccess={(loggedInUser) => {
                    setAuthErrorMessage('');
                    setUser(loggedInUser);
                    if (window.App) {
                        window.App.user = loggedInUser;
                    }

                    const hasPpmp = canUserAccessSystem(loggedInUser, '/eprocrementppmpapp');
                    const hasMonitoring = canUserAccessSystem(loggedInUser, '/monitoringsystem');
                    const hasSupplierEval = canUserAccessSystem(loggedInUser, '/supplierevaluation');
                    const route = parseRouteFromLocation();

                    if (route.view === 'monitoring') {
                        setLastActiveSystem('monitoring');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'monitoring'); } catch (_) {}
                        syncUrlAndState('monitoring', null, false);
                        setCurrentView('monitoring');
                        return;
                    }
                    if (route.view === 'supplierevaluation') {
                        setLastActiveSystem('supplierevaluation');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'supplierevaluation'); } catch (_) {}
                        syncUrlAndState('supplierevaluation', null, false);
                        setCurrentView('supplierevaluation');
                        return;
                    }

                    if (hasPpmp) {
                        setLastActiveSystem('dashboard');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'dashboard'); } catch (_) {}
                        if (route.view && route.view !== 'monitoring' && route.view !== 'supplierevaluation' && route.view !== 'landing') {
                            if ((route.view === 'detail' || route.view === 'edit') && route.uuid) {
                                setSelectedPpmpUuid(route.uuid);
                                setCurrentView(route.view);
                                loadPpmpDetail(route.uuid, false);
                                return;
                            }
                            handleNavigate(route.view, null, false);
                        } else {
                            handleNavigate('dashboard', null, false);
                        }
                    } else if (hasSupplierEval) {
                        setLastActiveSystem('supplierevaluation');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'supplierevaluation'); } catch (_) {}
                        syncUrlAndState('supplierevaluation', null, false);
                        setCurrentView('supplierevaluation');
                    } else if (hasMonitoring) {
                        setLastActiveSystem('monitoring');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'monitoring'); } catch (_) {}
                        syncUrlAndState('monitoring', null, false);
                        setCurrentView('monitoring');
                    } else {
                        setLastActiveSystem('dashboard');
                        try { sessionStorage.setItem(LAST_ACTIVE_SYSTEM_KEY, 'dashboard'); } catch (_) {}
                        handleNavigate('dashboard', null, false);
                    }
                }}
                onOpenPrivacy={() => {
                    syncUrlAndState('privacy', null, false);
                    setCurrentView('privacy');
                }}
            />
        );
    }

    // Supplier Evaluation System Access Check
    if (currentView === 'supplierevaluation') {
        if (!canUserAccessSystem(user, '/supplierevaluation')) {
            return (
                <UnauthorizedSystemAccessView
                    user={user}
                    attemptedSystem="/supplierevaluation"
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            );
        }

        return (
            <SupplierEvaluationDashboard
                user={user}
                onBackToPpmpSystem={canUserAccessSystem(user, '/eprocrementppmpapp') ? () => handleNavigate('dashboard') : null}
                onNavigateToPortal={() => handleNavigate('landing')}
                onLogout={handleLogout}
                onUserUpdate={(updatedUser) => setUser(updatedUser)}
            />
        );
    }

    // Monitoring System Access Check
    if (currentView === 'monitoring') {
        if (!canUserAccessSystem(user, '/monitoringsystem')) {
            return (
                <UnauthorizedSystemAccessView
                    user={user}
                    attemptedSystem="/monitoringsystem"
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            );
        }

        return (
            <MonitoringDashboard
                user={user}
                onBackToPpmpSystem={canUserAccessSystem(user, '/eprocrementppmpapp') ? () => handleNavigate('dashboard') : null}
                onNavigateToPortal={() => handleNavigate('landing')}
                onLogout={handleLogout}
            />
        );
    }

    // PPMP & APP System Access Check
    if (['dashboard', 'ppmps', 'create', 'edit', 'detail'].includes(currentView)) {
        if (!canUserAccessSystem(user, '/eprocrementppmpapp')) {
            return (
                <UnauthorizedSystemAccessView
                    user={user}
                    attemptedSystem="/eprocrementppmpapp"
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            );
        }
    }

    return (
        <MainLayout
            user={user}
            activeTab={currentView}
            onNavigate={handleNavigate}
            onSelectPpmp={(uuid) => loadPpmpDetail(uuid, true)}
            onLogout={handleLogout}
            onUserUpdate={(updatedUser) => setUser(updatedUser)}
        >
            {currentView === 'dashboard' && (
                <Dashboard
                    user={user}
                    data={dashboardData}
                    onSelectPpmp={(uuid) => loadPpmpDetail(uuid, true)}
                    onNavigate={handleNavigate}
                    onReload={loadDashboard}
                />
            )}

            {currentView === 'ppmps' && (
                <PPMPListPage
                    user={user}
                    onSelectPpmp={(uuid) => loadPpmpDetail(uuid, true)}
                    onNavigate={handleNavigate}
                />
            )}

            {currentView === 'create' && (
                <PPMPFormPage
                    user={user}
                    initialSourceOfFund={selectedSourceOfFund}
                    onBack={() => handleNavigate('dashboard')}
                    onSaved={(newPpmp) => {
                        loadPpmpDetail(newPpmp.uuid, true);
                        window.dispatchEvent(new CustomEvent('notifications:reload'));
                    }}
                />
            )}

            {currentView === 'edit' && (
                currentPpmp ? (
                    <PPMPFormPage
                        user={user}
                        initialPpmp={currentPpmp}
                        onBack={() => handleNavigate('detail', currentPpmp.uuid)}
                        onSaved={(updated) => {
                            loadPpmpDetail(updated.uuid, true);
                            window.dispatchEvent(new CustomEvent('notifications:reload'));
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[450px] py-20 text-slate-500">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-sm font-semibold text-slate-700">Loading PPMP Editor...</p>
                        <p className="text-xs text-slate-400 mt-1">Preparing form specifications</p>
                    </div>
                )
            )}

            {currentView === 'detail' && (
                currentPpmp ? (
                    <PPMPDetailPage
                        ppmp={currentPpmp}
                        user={user}
                        onBack={() => handleNavigate('ppmps')}
                        onEdit={() => handleNavigate('edit', currentPpmp.uuid)}
                        onReload={(targetUuid) => loadPpmpDetail(targetUuid || currentPpmp.uuid, false)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[450px] py-20 text-slate-500">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-sm font-semibold text-slate-700">Loading PPMP Details...</p>
                        <p className="text-xs text-slate-400 mt-1">Retrieving procurement package and review status</p>
                    </div>
                )
            )}

            <SourceOfFundModal
                isOpen={isSourceOfFundModalOpen}
                onClose={() => setIsSourceOfFundModalOpen(false)}
                onSelect={handleSelectSourceOfFund}
            />
        </MainLayout>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<App />);
}

