import React, { useState, useRef, useEffect } from 'react';
import {
    FileSpreadsheet,
    Activity,
    Layers,
    Shield,
    Globe,
    ChevronDown,
    Check,
    ArrowUpRight,
    Sparkles,
    Wrench,
} from 'lucide-react';
import { canUserAccessSystem, isPortalSystemActive } from '../UI/UnauthorizedSystemAccessView';
import { portalSystemService } from '../../services/api';

export const SYSTEM_OPTIONS = [
    {
        id: 'ppmp',
        path: '/eprocrementppmpapp',
        view: 'dashboard',
        name: 'E-Procurement PPMP & APP System',
        shortName: 'PPMP & APP System',
        badge: 'PPMP/APP',
        desc: 'PPMP lifecycle, APP consolidation & digital approvals',
        icon: FileSpreadsheet,
        color: 'blue',
        accentBg: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-blue-500/30',
        activeBadgeBg: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
        iconColor: 'text-blue-400',
    },
    {
        id: 'monitoring',
        path: '/monitoringsystem',
        view: 'monitoring',
        name: 'OPPMO Real-Time Monitoring System',
        shortName: 'OPPMO Monitoring System',
        badge: 'Live Tracking',
        desc: 'Procurement milestone tracking & office divisional flow',
        icon: Activity,
        color: 'emerald',
        accentBg: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        activeBadgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
        iconColor: 'text-emerald-400',
    },
    {
        id: 'supplierevaluation',
        path: '/supplierevaluation',
        view: 'supplierevaluation',
        name: 'Supplier Evaluation System',
        shortName: 'Supplier Evaluation',
        badge: 'Supplier Rating',
        desc: 'Province-wide supplier performance scoring & evaluation',
        icon: Shield,
        color: 'amber',
        accentBg: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30',
        activeBadgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
        iconColor: 'text-amber-400',
    },
];

export const SystemSwitcherDropdown = ({
    user,
    currentSystem = 'ppmp',
    onNavigate,
    className = '',
    align = 'right',
    fullWidth = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [portalSystems, setPortalSystems] = useState(() =>
        Array.isArray(window.App?.portal_systems) ? window.App.portal_systems : []
    );
    const dropdownRef = useRef(null);

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const res = await portalSystemService.getPublic();
                if (Array.isArray(res.data)) {
                    setPortalSystems(res.data);
                    if (window.App) window.App.portal_systems = res.data;
                }
            } catch (_) {}
        };
        if (portalSystems.length === 0) {
            fetchCatalog();
        }
        window.addEventListener('portal-systems:updated', fetchCatalog);
        return () => window.removeEventListener('portal-systems:updated', fetchCatalog);
    }, []);

    const accessibleSystems = SYSTEM_OPTIONS.filter((sys) => canUserAccessSystem(user, sys.path));

    const activeMeta = SYSTEM_OPTIONS.find((s) => s.id === currentSystem) || SYSTEM_OPTIONS[0];
    const ActiveIcon = activeMeta.icon;

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

    const handleSelectSystem = (sys) => {
        setIsOpen(false);
        if (sys.id === currentSystem) return;
        if (onNavigate) {
            onNavigate(sys.view);
        }
    };

    const handleGoPortal = () => {
        setIsOpen(false);
        if (onNavigate) {
            onNavigate('landing');
        }
    };

    return (
        <div className={`relative ${fullWidth ? 'block w-full' : 'inline-block'} text-left z-50 overflow-visible ${className}`} ref={dropdownRef}>

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`${fullWidth ? 'w-full justify-between' : ''} flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border shadow-xs ${
                    isOpen
                        ? 'bg-slate-800 text-white border-slate-600 shadow-md ring-2 ring-blue-500/30'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80 hover:border-slate-600'
                }`}
                title="Go to other provincial digital systems"
            >
                <div className="flex items-center gap-1.5">
                    <ActiveIcon className={`w-3.5 h-3.5 ${activeMeta.iconColor}`} />
                    <span className="hidden md:inline font-bold">Go to System</span>
                    <span className="md:hidden font-bold">Switch System</span>
                </div>

                {accessibleSystems.length > 1 && (
                    <span className="inline-flex px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {accessibleSystems.length}
                    </span>
                )}

                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-white' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div
                    className={`${
                        fullWidth
                            ? 'relative mt-2 w-full'
                            : `fixed left-3 right-3 top-16 sm:absolute sm:top-full sm:mt-2 sm:w-96 ${
                                align === 'right' ? 'sm:left-auto sm:right-0' : 'sm:right-auto sm:left-0'
                            }`
                    } rounded-2xl bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/80 z-[100] overflow-hidden divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-150`}
                    style={{ zIndex: 9999 }}
                >

                    <div className="px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>Provincial Digital Systems</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                Switch to another authorized procurement module
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {accessibleSystems.length} Available
                        </span>
                    </div>

                    <div className="p-2 space-y-1 max-h-[360px] overflow-y-auto">
                        {accessibleSystems.map((sys) => {
                            const isCurrent = sys.id === currentSystem;
                            const isSysActive = isPortalSystemActive(portalSystems, sys.path);
                            const IconComponent = sys.icon;

                            return (
                                <button
                                    key={sys.id}
                                    type="button"
                                    onClick={() => handleSelectSystem(sys)}
                                    className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex items-start gap-3 cursor-pointer group ${
                                        isCurrent
                                            ? 'bg-slate-800/90 border border-slate-700/80 shadow-inner'
                                            : !isSysActive
                                            ? 'opacity-75 hover:bg-slate-800/40 border border-amber-500/20'
                                            : 'hover:bg-slate-800/60 border border-transparent hover:border-slate-700/50'
                                    }`}
                                >

                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 shadow-inner ${
                                            !isSysActive
                                                ? 'bg-slate-800 border-slate-700 text-slate-400'
                                                : sys.color === 'emerald'
                                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                : sys.color === 'purple'
                                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                                : sys.color === 'amber'
                                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                                : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                        }`}
                                    >
                                        <IconComponent className="w-4 h-4 stroke-[2]" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <span
                                                className={`text-xs font-bold truncate transition-colors ${
                                                    !isSysActive
                                                        ? 'text-slate-400'
                                                        : isCurrent
                                                        ? 'text-white'
                                                        : 'text-slate-200 group-hover:text-white'
                                                }`}
                                            >
                                                {sys.name}
                                            </span>

                                            {!isSysActive ? (
                                                <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
                                                    <Wrench className="w-2.5 h-2.5" />
                                                    <span>Maintenance</span>
                                                </span>
                                            ) : isCurrent ? (
                                                <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                    <Check className="w-2.5 h-2.5" />
                                                    <span>Active</span>
                                                </span>
                                            ) : (
                                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>

                                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                                            {!isSysActive ? 'System currently inactive / under maintenance' : sys.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-2 bg-slate-950/60">
                        <button
                            type="button"
                            onClick={handleGoPortal}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-amber-400" />
                                <span>Public Portal Home</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">OPPMO Landing</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
