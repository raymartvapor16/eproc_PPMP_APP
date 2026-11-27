import React from 'react';
import {
    LayoutDashboard,
    BarChart3,
    FileSpreadsheet,
    Building2,
    Users,
    Shield,
    ShieldCheck,
    ChevronRight,
    TrendingUp,
    Activity,
    Landmark,
    Truck,
    Leaf,
    FileCheck2,
    Sliders,
    Globe,
    UserCheck,
    Tags,
    Database,
    Timer,
    ShieldAlert,
    Eye,
    Ticket,
} from 'lucide-react';

export const AdminSidebar = ({ activeSection, onSelectSection, metrics, pendingUsersCount }) => {
    const navItems = [
        {
            id: 'overview',
            label: 'Executive Overview',
            icon: LayoutDashboard,
            badge: metrics?.total_ppmps || 0,
            badgeColor: 'bg-blue-100 text-blue-800',
            description: 'Core KPIs & Recent Activities',
        },
        {
            id: 'portal_systems',
            label: 'Portal Systems',
            icon: Globe,
            badge: 'Landing',
            badgeColor: 'bg-blue-100 text-blue-800',
            description: 'Public Systems Catalog',
        },
        {
            id: 'oppmo_team',
            label: 'OPPMO Team Roster',
            icon: UserCheck,
            badge: 'About Us',
            badgeColor: 'bg-amber-100 text-amber-800',
            description: 'Team Bios & Photos',
        },
        {
            id: 'analytics',
            label: 'Visual Analytics',
            icon: BarChart3,
            badge: 'Live',
            badgeColor: 'bg-emerald-100 text-emerald-800',
            description: 'Budgets & Procurement Modes',
        },
        {
            id: 'reports',
            label: 'Reports & Exports',
            icon: FileSpreadsheet,
            badge: metrics?.ready_to_print ? `${metrics.ready_to_print * 2} docs` : null,
            badgeColor: 'bg-emerald-100 text-emerald-800',
            description: 'Excel & Bulk PPMP/APP PDF',
        },
        {
            id: 'offices',
            label: 'Offices & Departments',
            icon: Building2,
            badge: null,
            description: 'Masterlist & CSV Import',
        },
        {
            id: 'fund_sources',
            label: 'Sources of Fund',
            icon: Landmark,
            badge: null,
            description: 'Review Routes & Funds',
        },
        {
            id: 'procurement_modes',
            label: 'Modes of Procurement',
            icon: Tags,
            badge: 'RA 12009',
            badgeColor: 'bg-indigo-100 text-indigo-800',
            description: 'RA 12009 Modes Masterlist',
        },
        {
            id: 'conditions',
            label: 'Delivery Conditions',
            icon: Truck,
            badge: null,
            description: 'Delivery & Payment Terms',
        },
        {
            id: 'other_terms',
            label: 'Other Terms & Specs',
            icon: Leaf,
            badge: null,
            description: 'Green Specs & Custom Terms',
        },
        {
            id: 'supporting_docs',
            label: 'Supporting Documents',
            icon: FileCheck2,
            badge: null,
            description: 'Pre Canvass, PO, Attachments',
        },
        {
            id: 'users',
            label: 'User Accounts',
            icon: Users,
            badge: pendingUsersCount > 0 ? `${pendingUsersCount} pending` : null,
            badgeColor: 'bg-amber-100 text-amber-800 animate-pulse',
            description: 'Roles & Passwords',
        },
        {
            id: 'monitoring_viewers',
            label: 'Authorize Viewer (Monitoring)',
            icon: Eye,
            badge: null,
            description: 'View All Published PPMPs',
        },
        {
            id: 'signatories',
            label: 'Official Signatories',
            icon: Shield,
            badge: null,
            description: 'Governor & Reviewers',
        },
        {
            id: 'security',
            label: 'Security & Access Controls',
            icon: ShieldCheck,
            badge: 'Active',
            badgeColor: 'bg-emerald-100 text-emerald-800 font-bold',
            description: 'DevTools, E-Sign & Policies',
        },
        {
            id: 'afk_management',
            label: 'AFK Auto-Logout',
            icon: Timer,
            badge: '15 Min',
            badgeColor: 'bg-amber-100 text-amber-800 font-bold',
            description: 'Inactivity & Auto-Logout',
        },
        {
            id: 'system_requests',
            label: 'System Requests',
            icon: Ticket,
            badge: 'Tickets',
            badgeColor: 'bg-blue-100 text-blue-800 font-bold',
            description: 'Bug Fixes & Enhancements',
        },
        {
            id: 'security_threats',
            label: 'Threat & Intrusion Logs',
            icon: ShieldAlert,
            badge: 'IDS / Backup',
            badgeColor: 'bg-rose-100 text-rose-800 font-bold',
            description: 'IDS, Manual & 15-Day Backup',
        },
        {
            id: 'logs',
            label: 'Activity Logs',
            icon: Activity,
            badge: null,
            badgeColor: 'bg-indigo-100 text-indigo-800',
            description: 'Full System Audit Trail',
        },
    ];

    return (
        <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden sticky top-20">

                <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white border-b border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/90 flex items-center justify-center font-bold text-white shadow-xs border border-blue-400/30">
                            <Shield className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-xs font-black uppercase tracking-wider text-blue-200">
                                Super Admin Portal
                            </div>
                            <div className="text-[11px] text-slate-300 font-medium truncate">
                                Executive Governance &amp; Analytics
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-2 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id ||
                            (item.id === 'security' && activeSection === 'settings') ||
                            (item.id === 'afk_management' && activeSection === 'afk');
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelectSection(item.id)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer group ${
                                    isActive
                                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className={`p-1.5 rounded-lg transition ${
                                            isActive
                                                ? 'bg-blue-700 text-white'
                                                : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                    </div>
                                    <div className="min-w-0">
                                        <div
                                            className={`text-xs leading-tight truncate ${
                                                isActive ? 'text-white' : 'text-slate-900 group-hover:text-blue-600'
                                            }`}
                                        >
                                            {item.label}
                                        </div>
                                        <div
                                            className={`text-[10px] truncate ${
                                                isActive ? 'text-blue-100' : 'text-slate-400'
                                            }`}
                                        >
                                            {item.description}
                                        </div>
                                    </div>
                                </div>

                                {item.badge && (
                                    <span
                                        className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                            isActive
                                                ? 'bg-blue-800 text-blue-100'
                                                : item.badgeColor || 'bg-slate-100 text-slate-700'
                                        }`}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">Province of Davao del Sur</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                        </span>
                    </div>
                    <div className="text-slate-400">
                        E-Procurement Management
                    </div>
                </div>
            </div>
        </aside>
    );
};
