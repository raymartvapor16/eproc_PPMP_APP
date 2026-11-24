import React, { useState } from 'react';
import {
    ShieldCheck,
    ShieldAlert,
    Lock,
    KeyRound,
    FileCheck2,
    FileCode,
    Activity,
    Globe,
    Layers,
    AlertTriangle,
    CheckCircle2,
    Sliders,
    Eye,
    EyeOff,
    Terminal,
    RefreshCw,
    Server,
    HardDrive,
    Database,
    Zap,
} from 'lucide-react';
import { SystemSettingsManagement } from './SystemSettingsManagement';
import { SignatureControllerManagement } from './SignatureControllerManagement';
import { AfkLogoutManagement } from './AfkLogoutManagement';
import { AdminActivityLog } from './AdminActivityLog';

export const UnifiedSecurityControls = () => {
    const [subTab, setSubTab] = useState('controls');

    return (
        <div className="space-y-6 animate-in fade-in duration-150">

            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight text-white uppercase">
                                    Unified Security &amp; Access Controls
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Live Protection Active
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                Centralized security command center for Super Administrators. Manage developer mode lockouts, digital signature gates, binary file upload guards, anti-ransomware checks, and live audit telemetry.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 self-start md:self-auto">
                        <button
                            type="button"
                            onClick={() => setSubTab('controls')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                subTab === 'controls'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Security Switches</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('policies')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                subTab === 'policies'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Threat Defenses</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('audit_log')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                subTab === 'audit_log'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Security Audit Trail</span>
                        </button>
                    </div>
                </div>
            </div>

            {subTab === 'controls' && (
                <div className="space-y-6">

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-blue-600" />
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    1. Developer Inspection &amp; Session Hijack Lockdown
                                </h3>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                                Strict User-Agent Fingerprint Validation
                            </span>
                        </div>
                        <div className="p-5">
                            <SystemSettingsManagement />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    2. Official E-Signature Automation Gates
                                </h3>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                                PPMP, APP, &amp; Attachment List Specimen Stamping
                            </span>
                        </div>
                        <div className="p-5">
                            <SignatureControllerManagement />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-emerald-600" />
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    3. File Upload Quotas &amp; Anti-Ransomware Binary Verification
                                </h3>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                🔒 Strict Validation Active
                            </span>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900">General Documents &amp; Photos</span>
                                    <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                                        Max 5 MB
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    Applies to PPMP supporting files, Market Scoping PDFs, official Authorization Letters, and User Profile avatars (JPG, PNG, WebP, PDF).
                                </p>
                                <div className="pt-2 border-t border-blue-100 flex items-center gap-2 text-[10px] text-blue-800 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Magic byte verified (%PDF-, \x89PNG, \xFF\xD8\xFF)</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-900">Supplier Evaluation System</span>
                                    <span className="text-xs font-black text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">
                                        Max 15 MB
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    High-capacity limit reserved exclusively for complex Purchase Order PDFs and Multi-page Vendor Authorizations in the Supplier Evaluation portal.
                                </p>
                                <div className="pt-2 border-t border-amber-100 flex items-center gap-2 text-[10px] text-amber-800 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Anti-macro scanning &amp; Disguised extension shielding</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <AfkLogoutManagement />
                </div>
            )}

            {subTab === 'policies' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Anti-Phishing Shield</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">Domain &amp; Link Security Interstitials</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            External cloud links (Google Drive, Dropbox, OneDrive) must use HTTPS and display safety interstitials before navigation. Outbound links use strict <code className="text-blue-600 font-mono text-[10px]">rel="noopener noreferrer"</code>.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: Active Interstitial Warning
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Credential Defense</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">Rate Limiting &amp; Lockout</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Logins throttled to 5 attempts per minute with progressive lockout delay. Public registration incorporates dynamic alphanumeric CAPTCHA to defeat automated stuffing bots.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: 5 Attempts / IP Throttled
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Database Defense</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">Parameterized ORM Queries</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            All database queries utilize Eloquent ORM with PDO prepared statements and strict parameter binding. Raw user input concatenation is systematically forbidden.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: 100% Prepared Statements
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Client-Side Shield</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">XSS &amp; CSRF Verification</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Defensive HTTP headers (<code className="text-blue-600 font-mono text-[10px]">X-Frame-Options: SAMEORIGIN</code>, <code className="text-blue-600 font-mono text-[10px]">X-Content-Type-Options: nosniff</code>) and strict CSRF token validation on all state modifications.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: SameSite + CSRF Tokens
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Transport Security</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">Session Fingerprint Lockdown</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            SHA-256 client User-Agent hash tracking automatically terminates sessions if stolen cookies are used on differing devices. HSTS headers and HttpOnly cookie flags active.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: Fingerprint Validation Active
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Storage &amp; Availability</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">Isolated Storage &amp; Throttle</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            All user uploads stored in secure non-public storage (<code className="text-blue-600 font-mono text-[10px]">storage/app/private</code>) served exclusively through authorized controller routes, preventing directory traversal and execution.
                        </p>
                        <div className="pt-2 text-[10px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            ✓ Status: Private Disks + Route Throttling
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'audit_log' && (
                <div className="space-y-4">
                    <AdminActivityLog />
                </div>
            )}
        </div>
    );
};
