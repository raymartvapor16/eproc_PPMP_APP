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
import { SourceOfFundModal, FUND_SOURCES } from './components/PPMP/SourceOfFundModal';
import { initDevToolsGuard } from './utils/devToolsGuard';

export function App() {
    const [user, setUser] = useState(() => window.App?.user || null);
    const [loading, setLoading] = useState(() => !window.App?.user && window.App !== undefined ? false : false);
    const [authErrorMessage, setAuthErrorMessage] = useState('');
    const [currentView, setCurrentView] = useState(() => {
        if (window.location.pathname === '/privacy') return 'privacy';
        if (window.location.pathname === '/monitoringsystem' || window.location.pathname.startsWith('/monitoring')) return 'monitoring';
        if (window.App?.user?.role === 'monitor') return 'monitoring';
        return 'dashboard';
    }); // dashboard, ppmps, create, detail, edit, privacy, monitoring
    const [selectedPpmpUuid, setSelectedPpmpUuid] = useState(null);
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
            if (profileUser?.role === 'monitor') {
                setCurrentView('monitoring');
                if (window.location.pathname !== '/monitoringsystem') {
                    window.history.replaceState({}, '', '/monitoringsystem');
                }
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

    const loadPpmpDetail = async (uuid) => {
        try {
            const res = await ppmpService.getOne(uuid);
            const ppmpObj = res.data.ppmp;
            if (res.data.default_signatories) {
                ppmpObj.default_signatories = res.data.default_signatories;
            }
            setCurrentPpmp(ppmpObj);
            setSelectedPpmpUuid(uuid);
            setCurrentView('detail');
            return true;
        } catch (e) {
            alert(e.response?.data?.message || 'Failed to load PPMP details.');
            return false;
        }
    };

    const handleNavigate = (view) => {
        if (user?.role === 'monitor') {
            setCurrentView('monitoring');
            window.history.replaceState({}, '', '/monitoringsystem');
            return;
        }
        if (view === 'monitoring') {
            // Strictly restricted to monitor role only
            if (user?.role !== 'monitor') {
                setCurrentView('dashboard');
                window.history.replaceState({}, '', '/');
                return;
            }
            window.history.pushState({}, '', '/monitoringsystem');
            setCurrentView('monitoring');
            return;
        }
        if (view === 'create') {
            setIsSourceOfFundModalOpen(true);
            return;
        }
        if (view === 'users') {
            if (window.location.pathname !== '/') {
                window.history.pushState({}, '', '/');
            }
            setCurrentView('dashboard');
            loadDashboard();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('admin:navigate_section', { detail: { section: 'users' } }));
            }, 50);
            return;
        }
        if (view === 'dashboard' && window.location.pathname !== '/') {
            window.history.pushState({}, '', '/');
        }
        setCurrentView(view);
        if (view === 'dashboard') loadDashboard();
    };

    const handleSelectSourceOfFund = (fund) => {
        setSelectedSourceOfFund(fund);
        setIsSourceOfFundModalOpen(false);
        setCurrentView('create');
    };

    const userRef = React.useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        initDevToolsGuard();
        checkAuth();

        const handleUnauthorized = (e) => {
            setUser(null);
            setCurrentView('dashboard');
            if (e?.detail?.reason) {
                setAuthErrorMessage(e.detail.reason);
            }
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);

        const handleDevToolsUnauthorized = (e) => {
            if (e?.detail?.message) {
                setAuthErrorMessage(e.detail.message);
            }
            setUser(null);
            setCurrentView('dashboard');
        };
        window.addEventListener('devtools:unauthorized', handleDevToolsUnauthorized);

        const handlePopState = () => {
            const currentUser = userRef.current;
            if (window.location.pathname === '/privacy') {
                setCurrentView('privacy');
            } else if (window.location.pathname === '/monitoringsystem' || window.location.pathname.startsWith('/monitoring')) {
                if (currentUser?.role === 'monitor') {
                    setCurrentView('monitoring');
                } else {
                    // Non-monitor roles cannot access monitoring
                    window.history.replaceState({}, '', '/');
                    setCurrentView('dashboard');
                }
            } else {
                if (currentUser?.role === 'monitor') {
                    setCurrentView('monitoring');
                    window.history.replaceState({}, '', '/monitoringsystem');
                } else {
                    setCurrentView('dashboard');
                }
            }
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
        if (user.role === 'monitor') {
            setCurrentView('monitoring');
            if (window.location.pathname !== '/monitoringsystem') {
                window.history.replaceState({}, '', '/monitoringsystem');
            }
        } else {
            if (window.location.pathname === '/monitoringsystem') {
                window.history.replaceState({}, '', '/');
                setCurrentView('dashboard');
            }
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
                    loadPpmpDetail(selectedPpmpUuid);
                }
            }
        };
        window.addEventListener('app:data_reload', handleDataReload);
        return () => window.removeEventListener('app:data_reload', handleDataReload);
    }, [user, currentView, selectedPpmpUuid]);

    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (e) {
            console.error(e);
        } finally {
            setUser(null);
            setCurrentPpmp(null);
            setSelectedPpmpUuid(null);
            if (window.App) window.App.user = null;
            if (window.location.pathname === '/monitoringsystem') {
                window.history.replaceState({}, '', '/');
            }
            setCurrentView('dashboard');
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

    if (currentView === 'privacy') {
        return (
            <PrivacyPolicyPage
                onBack={() => {
                    if (window.location.pathname === '/privacy') {
                        window.history.pushState({}, '', '/');
                    }
                    setCurrentView('dashboard');
                }}
            />
        );
    }

    if (!user) {
        return (
            <LoginPage
                initialError={authErrorMessage}
                onLoginSuccess={(loggedInUser) => {
                    setAuthErrorMessage('');
                    setUser(loggedInUser);
                    if (window.App) {
                        window.App.user = loggedInUser;
                    }
                    if (loggedInUser?.role === 'monitor') {
                        window.history.pushState({}, '', '/monitoringsystem');
                        setCurrentView('monitoring');
                    } else {
                        if (window.location.pathname === '/monitoringsystem') {
                            window.history.replaceState({}, '', '/');
                        }
                        setCurrentView('dashboard');
                    }
                }}
                onOpenPrivacy={() => {
                    window.history.pushState({}, '', '/privacy');
                    setCurrentView('privacy');
                }}
            />
        );
    }

    // Monitor role ONLY accesses the Monitoring Dashboard
    if (user?.role === 'monitor') {
        return (
            <MonitoringDashboard
                user={user}
                onLogout={handleLogout}
            />
        );
    }

    // Any other role (enduser, etc.) CANNOT access monitoring
    if (currentView === 'monitoring') {
        if (window.location.pathname === '/monitoringsystem') {
            window.history.replaceState({}, '', '/');
        }
        setCurrentView('dashboard');
        return null;
    }

    return (
        <MainLayout
            user={user}
            activeTab={currentView}
            onNavigate={handleNavigate}
            onSelectPpmp={(uuid) => loadPpmpDetail(uuid)}
            onLogout={handleLogout}
            onUserUpdate={(updatedUser) => setUser(updatedUser)}
        >
            {currentView === 'dashboard' && (
                <Dashboard
                    user={user}
                    data={dashboardData}
                    onSelectPpmp={(uuid) => loadPpmpDetail(uuid)}
                    onNavigate={handleNavigate}
                    onReload={loadDashboard}
                />
            )}

            {currentView === 'ppmps' && (
                <PPMPListPage
                    user={user}
                    onSelectPpmp={(uuid) => loadPpmpDetail(uuid)}
                    onNavigate={handleNavigate}
                />
            )}

            {currentView === 'create' && (
                <PPMPFormPage
                    user={user}
                    initialSourceOfFund={selectedSourceOfFund}
                    onBack={() => setCurrentView('dashboard')}
                    onSaved={(newPpmp) => {
                        loadPpmpDetail(newPpmp.uuid);
                        window.dispatchEvent(new CustomEvent('notifications:reload'));
                    }}
                />
            )}

            {currentView === 'edit' && currentPpmp && (
                <PPMPFormPage
                    user={user}
                    initialPpmp={currentPpmp}
                    onBack={() => setCurrentView('detail')}
                    onSaved={(updated) => {
                        loadPpmpDetail(updated.uuid);
                        window.dispatchEvent(new CustomEvent('notifications:reload'));
                    }}
                />
            )}

            {currentView === 'detail' && currentPpmp && (
                <PPMPDetailPage
                    ppmp={currentPpmp}
                    user={user}
                    onBack={() => setCurrentView('ppmps')}
                    onEdit={() => setCurrentView('edit')}
                    onReload={(targetUuid) => loadPpmpDetail(targetUuid || currentPpmp.uuid)}
                />
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
