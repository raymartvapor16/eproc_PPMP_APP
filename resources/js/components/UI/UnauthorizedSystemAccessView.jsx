import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowRight, Globe, LogOut, CheckCircle2, AlertTriangle, Layers, Building2, Wrench, Power, Loader2 } from 'lucide-react';
import { portalSystemService } from '../../services/api';

export const SYSTEM_METADATA = {
    '/eprocrementppmpapp': {
        name: 'E-Procurement PPMP & APP System',
        path: '/eprocrementppmpapp',
        view: 'dashboard',
        desc: 'Annual Procurement Plan (APP) preparation, PPMP submission, multi-tier evaluation & digital endorsements.',
        badge: 'Primary Procurement System',
        color: 'blue',
    },
    '/monitoringsystem': {
        name: 'OPPMO Real-Time Monitoring System',
        path: '/monitoringsystem',
        view: 'monitoring',
        desc: 'Live tracking of Goods, Consulting, and Infra procurement through PR, Technical, BAC Support, and Contracting divisions.',
        badge: 'Live Office Monitoring',
        color: 'emerald',
    },
    '/supplierevaluation': {
        name: 'Supplier Evaluation System',
        path: '/supplierevaluation',
        view: 'supplierevaluation',
        desc: 'Province-wide Supplier Performance Evaluation, Purchase Order Management, Bulk Evaluation, and Semester Analytics.',
        badge: 'Supplier Rating',
        color: 'amber',
    },
    '/pims': {
        name: 'Procurement Information Management System (PIMS)',
        path: '/pims',
        view: 'pims',
        desc: 'Comprehensive procurement surveillance, Purchase Request (PR) generation, and multi-stage evaluation across provincial offices.',
        badge: 'PIMS Portal',
        color: 'purple',
    },
};

export const resolveCanonicalSystemPath = (pathOrView) => {
    const raw = String(pathOrView || '').trim().replace(/\/+$/, '').toLowerCase();
    if (['dashboard', 'ppmps', 'create', 'edit', 'detail', '/eprocrementppmpapp', '/eprocurementppmpapp', '/dashboard', '/ppmps'].includes(raw) || raw.startsWith('/ppmps/')) {
        return '/eprocrementppmpapp';
    }
    if (['pims', '/pims', '/pimssystem'].includes(raw) || raw.startsWith('/pims')) {
        return '/pims';
    }
    if (['monitoring', '/monitoringsystem', '/monitoring'].includes(raw) || raw.startsWith('/monitoring')) {
        return '/monitoringsystem';
    }
    if (['supplierevaluation', '/supplierevaluation', '/supplier-evaluation'].includes(raw) || raw.startsWith('/supplier-evaluation')) {
        return '/supplierevaluation';
    }
    return raw;
};

export const findPortalSystemByPathOrView = (portalSystems, pathOrView) => {
    if (!Array.isArray(portalSystems) || portalSystems.length === 0) return null;
    const canonical = resolveCanonicalSystemPath(pathOrView);
    if (!canonical) return null;

    return portalSystems.find((sys) => {
        const sysCanonical = resolveCanonicalSystemPath(sys?.link_url);
        return sysCanonical === canonical;
    }) || null;
};

export const isPortalSystemActive = (portalSystems, pathOrView) => {
    const matched = findPortalSystemByPathOrView(portalSystems, pathOrView);
    if (!matched) return true;
    return matched.status !== 'inactive';
};

export const canUserAccessSystem = (user, systemUrl) => {
    if (!user) return false;

    if (user.role === 'super_admin' || user.role === 'admin') return true;

    const raw = (systemUrl || '').trim();

    if (/^https?:\/\//i.test(raw) || (!raw.startsWith('/') && !raw.startsWith('#') && raw.includes('.'))) {
        return true;
    }

    let accessible = [];
    if (Array.isArray(user.accessible_systems)) {
        accessible = user.accessible_systems;
    } else if (typeof user.accessible_systems === 'string') {
        try {
            accessible = JSON.parse(user.accessible_systems);
        } catch (_) {
            accessible = [];
        }
    }

    if (accessible.includes('*')) return true;

    const target = (systemUrl || '').replace(/\/+$/, '').toLowerCase();

    if (accessible.length > 0) {
        return accessible.some(sys => {
            const item = (sys || '').replace(/\/+$/, '').toLowerCase();
            if (item === target) return true;
            if ((item === '/eprocrementppmpapp' || item === '/eprocurementppmpapp') &&
                (target === '/eprocrementppmpapp' || target === '/eprocurementppmpapp')) {
                return true;
            }
            if ((item === '/supplierevaluation' || item === '/supplier-evaluation') &&
                (target === '/supplierevaluation' || target === '/supplier-evaluation')) {
                return true;
            }
            if ((item === '/pims' || item === '/pimssystem') &&
                (target === '/pims' || target === '/pimssystem' || target.startsWith('/pims'))) {
                return true;
            }
            if ((item === '/monitoringsystem' || item === '/monitoring') &&
                (target === '/monitoringsystem' || target.startsWith('/monitoring'))) {
                return true;
            }
            return false;
        });
    }

    if (user.role === 'monitor') {
        return target === '/monitoringsystem' || target.startsWith('/monitoring');
    }
    if (['pgso', 'presentative_staff'].includes(user.role)) {
        return target === '/supplierevaluation' || target.startsWith('/supplier-evaluation');
    }

    return target === '/eprocrementppmpapp' || target === '/eprocurementppmpapp';
};

export const UnauthorizedSystemAccessView = ({
    user,
    attemptedSystem = '/eprocrementppmpapp',
    onNavigate,
    onLogout,
}) => {
    const meta = SYSTEM_METADATA[attemptedSystem] || {
        name: 'Requested Digital System',
        path: attemptedSystem,
        desc: 'This provincial digital system requires authorized credentials.',
        badge: 'Provincial System',
    };

    const accessibleList = Object.values(SYSTEM_METADATA).filter(sys => canUserAccessSystem(user, sys.path));

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-between font-sans selection:bg-rose-500 selection:text-white">

            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src="/images/logo.png"
                            alt="Davao del Sur Seal"
                            className="w-9 h-9 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <img
                            src="/images/pmo.jpeg"
                            alt="OPPMO Seal"
                            className="w-9 h-9 object-cover rounded-full border border-amber-400/40"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div>
                            <div className="text-xs font-black tracking-wider uppercase text-white">
                                Provincial Digital Procurement Portal
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">
                                Province of Davao del Sur
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onNavigate && onNavigate('landing')}
                            className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                            <span>Portal Home</span>
                        </button>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="text-xs text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer font-semibold"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
                <div className="max-w-xl w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 backdrop-blur-xl animate-in fade-in zoom-in-95">

                    <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/10 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
                            <ShieldAlert className="w-8 h-8" />
                        </div>
                    </div>

                    <div className="text-center space-y-2 mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[11px] font-bold uppercase tracking-wider border border-rose-500/30">
                            <Lock className="w-3 h-3" />
                            <span>System Access Restricted</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            Access Not Authorized
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                            You are signed in as <span className="font-semibold text-white">{user?.name}</span> ({user?.email}), but your account is not authorized to access:
                        </p>
                        <div className="inline-block mt-1 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-rose-500/40 text-amber-300 font-bold text-xs">
                            {meta.name}
                        </div>
                    </div>

                    {accessibleList.length > 0 ? (
                        <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Systems Authorized for Your Account</span>
                            </div>
                            <div className="space-y-2">
                                {accessibleList.map(item => (
                                    <div
                                        key={item.path}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition group"
                                    >
                                        <div className="min-w-0 pr-3">
                                            <div className="text-xs font-bold text-white group-hover:text-blue-300 transition truncate">
                                                {item.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                {item.path}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate && onNavigate(item.view)}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                        >
                                            <span>Enter</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200/90 leading-relaxed">
                            <strong className="text-amber-300 font-bold block mb-1">No Active System Permissions Assigned</strong>
                            Your registered account does not currently have permissions assigned for any digital systems yet.
                        </div>
                    )}

                    <div className="bg-gradient-to-r from-blue-950/40 to-slate-950/60 border border-blue-900/50 rounded-xl p-4 text-xs text-slate-300 space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-blue-300 font-bold">
                            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>In-Person (Face-to-Face) Access Request Policy</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Provincial procurement data security mandates that any addition or modification to user system access requires submitting a duly accomplished <strong>User Access Form</strong> in person (face-to-face) to the <strong>Office of the Provincial Procurement Management Officer (OPPMO)</strong>.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => onNavigate && onNavigate('landing')}
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                        >
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                            <span>Return to Portal Home</span>
                        </button>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/30"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Log Out</span>
                        </button>
                    </div>
                </div>
            </main>

            <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500">
                © {new Date().getFullYear()} Provincial Government of Davao del Sur • Office of the Provincial Procurement Management Officer (OPPMO)
            </footer>
        </div>
    );
};

export const SystemMaintenanceView = ({
    user = null,
    attemptedSystem = '/pims',
    portalSystems = [],
    onNavigate,
    onLogout,
    onBypassMaintenance,
}) => {
    const [reactivating, setReactivating] = useState(false);
    const canonicalPath = resolveCanonicalSystemPath(attemptedSystem);
    const catalogSystem = findPortalSystemByPathOrView(portalSystems, canonicalPath);
    const meta = SYSTEM_METADATA[canonicalPath] || {
        name: catalogSystem?.name || 'Provincial Digital System',
        path: canonicalPath || attemptedSystem,
        desc: catalogSystem?.description || 'This provincial digital system is currently inactive or undergoing scheduled maintenance.',
        badge: catalogSystem?.badge || 'Portal System',
    };

    const displayName = catalogSystem?.name || meta.name;
    const displayDesc = catalogSystem?.description || meta.desc;

    const activeAvailableSystems = Object.values(SYSTEM_METADATA).filter((sys) => {
        if (sys.path === canonicalPath) return false;
        if (!isPortalSystemActive(portalSystems, sys.path)) return false;
        return user ? canUserAccessSystem(user, sys.path) : true;
    });

    const handleQuickReactivate = async () => {
        if (!catalogSystem?.id || reactivating) return;
        setReactivating(true);
        try {
            await portalSystemService.toggleStatus(catalogSystem.id);
            window.dispatchEvent(new CustomEvent('portal-systems:updated'));
            window.dispatchEvent(new CustomEvent('pims:status_changed'));
        } catch (err) {
            console.error('Failed to reactivate system', err);
        } finally {
            setReactivating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">

            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src="/images/logo.png"
                            alt="Davao del Sur Seal"
                            className="w-9 h-9 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <img
                            src="/images/pmo.jpeg"
                            alt="OPPMO Seal"
                            className="w-9 h-9 object-cover rounded-full border border-amber-400/40"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div>
                            <div className="text-xs font-black tracking-wider uppercase text-white">
                                Provincial Digital Procurement Portal
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">
                                Province of Davao del Sur
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onNavigate && onNavigate('landing')}
                            className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                            <span>Portal Home</span>
                        </button>
                        {user && onLogout && (
                            <button
                                type="button"
                                onClick={onLogout}
                                className="text-xs text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer font-semibold"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Sign Out</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
                <div className="max-w-xl w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 backdrop-blur-xl animate-in fade-in zoom-in-95 relative">

                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

                    <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-800 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/40">
                            <Wrench className="w-8 h-8" />
                        </div>
                    </div>

                    <div className="text-center space-y-2.5 mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span>System Inactive • Under Maintenance</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            {displayName}
                        </h1>
                        <div className="inline-block px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 font-mono text-xs">
                            {meta.path}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto pt-1">
                            This system is currently marked as <span className="font-bold text-amber-300">Inactive / Under Maintenance</span> in the Provincial Portal Systems Catalog and is temporarily unavailable for access.
                        </p>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-amber-300 font-bold">
                            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>OPPMO System Status Notice</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {displayDesc}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
                            Access will automatically resume once the System Administrator sets the module status back to <strong className="text-emerald-400">Active</strong> in the Portal Systems Catalog.
                        </p>
                    </div>

                    {user?.role === 'super_admin' && (
                        <div className="mb-6 bg-blue-950/30 border border-blue-500/30 rounded-xl p-4 space-y-3">
                            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center justify-between">
                                <span>Super Administrator Controls</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-200">
                                    SUPER ADMIN
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                As Super Administrator, you can reactivate this system immediately or open the Portal Systems Catalog.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                {catalogSystem?.id && (
                                    <button
                                        type="button"
                                        onClick={handleQuickReactivate}
                                        disabled={reactivating}
                                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                                    >
                                        {reactivating ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Power className="w-3.5 h-3.5" />
                                        )}
                                        <span>Reactivate System Now</span>
                                    </button>
                                )}
                                {onBypassMaintenance && (
                                    <button
                                        type="button"
                                        onClick={onBypassMaintenance}
                                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                                    >
                                        <span>Open Portal Catalog Settings</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {activeAvailableSystems.length > 0 && (
                        <div className="mb-6 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Active Systems Available</span>
                            </div>
                            <div className="space-y-2">
                                {activeAvailableSystems.map((item) => (
                                    <div
                                        key={item.path}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition group"
                                    >
                                        <div className="min-w-0 pr-3">
                                            <div className="text-xs font-bold text-white group-hover:text-blue-300 transition truncate">
                                                {item.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                {item.path}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate && onNavigate(item.view)}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                                        >
                                            <span>Open</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => onNavigate && onNavigate('landing')}
                            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Return to Portal Home</span>
                        </button>
                        {user && onLogout && (
                            <button
                                type="button"
                                onClick={onLogout}
                                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/30"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Log Out</span>
                            </button>
                        )}
                    </div>
                </div>
            </main>

            <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500">
                © {new Date().getFullYear()} Provincial Government of Davao del Sur • Office of the Provincial Procurement Management Officer (OPPMO)
            </footer>
        </div>
    );
};
