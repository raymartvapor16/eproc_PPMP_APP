import React from 'react';
import { ShieldAlert, Lock, ArrowRight, Globe, LogOut, CheckCircle2, AlertTriangle, Layers, Building2 } from 'lucide-react';

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
};

/**
 * Helper to check if a user is permitted to access a given system route
 */
export const canUserAccessSystem = (user, systemUrl) => {
    if (!user) return false;
    // Admins and Super Admins have universal system access
    if (user.role === 'super_admin' || user.role === 'admin') return true;

    const raw = (systemUrl || '').trim();
    // External websites / public destinations do not require internal permission checks
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
    
    // Check backward compatibility: if role is 'monitor' and system is '/monitoringsystem'
    if (user.role === 'monitor' && (target === '/monitoringsystem' || target.startsWith('/monitoring'))) {
        return true;
    }

    // Supplier Evaluation dedicated roles ('pgso', 'presentative_staff', 'administrator') have access to '/supplierevaluation'
    if (['pgso', 'presentative_staff', 'administrator'].includes(user.role) && (target === '/supplierevaluation' || target.startsWith('/supplier-evaluation'))) {
        return true;
    }

    return accessible.some(sys => {
        const item = (sys || '').replace(/\/+$/, '').toLowerCase();
        if (item === target) return true;
        // Check variations of eprocrementppmpapp vs eprocurementppmpapp
        if ((item === '/eprocrementppmpapp' || item === '/eprocurementppmpapp') &&
            (target === '/eprocrementppmpapp' || target === '/eprocurementppmpapp')) {
            return true;
        }
        if ((item === '/supplierevaluation' || item === '/supplier-evaluation') &&
            (target === '/supplierevaluation' || target === '/supplier-evaluation')) {
            return true;
        }
        return false;
    });
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

    // Determine which systems this user is permitted to access
    const accessibleList = Object.values(SYSTEM_METADATA).filter(sys => canUserAccessSystem(user, sys.path));

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-between font-sans selection:bg-rose-500 selection:text-white">
            {/* Header Brand Bar */}
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

            {/* Main Restricted Message Container */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
                <div className="max-w-xl w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 backdrop-blur-xl animate-in fade-in zoom-in-95">
                    {/* Top Alert Badge */}
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

                    {/* Permitted Systems or Empty Notice */}
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

                    {/* Face to Face Policy Notice Box */}
                    <div className="bg-gradient-to-r from-blue-950/40 to-slate-950/60 border border-blue-900/50 rounded-xl p-4 text-xs text-slate-300 space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-blue-300 font-bold">
                            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>In-Person (Face-to-Face) Access Request Policy</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Provincial procurement data security mandates that additions or modifications to user system access must be requested in person (face-to-face) with the <strong>Office of the Provincial Procurement Management Officer (OPPMO)</strong> or your <strong>System Administrator</strong>.
                        </p>
                    </div>

                    {/* Bottom Actions */}
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

            {/* Footer */}
            <footer className="border-t border-slate-900 py-4 text-center text-[11px] text-slate-500">
                © {new Date().getFullYear()} Provincial Government of Davao del Sur • Office of the Provincial Procurement Management Officer (OPPMO)
            </footer>
        </div>
    );
};
