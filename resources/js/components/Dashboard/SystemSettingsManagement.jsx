import React, { useState, useEffect } from 'react';
import {
    Terminal,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Lock,
    Unlock,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Sliders,
    Eye,
    EyeOff,
    Info,
    Check,
    PenTool
} from 'lucide-react';
import { systemSettingService } from '../../services/api';
import { isDeveloperModeActive, setDeveloperModeActive } from '../../utils/devToolsGuard';
import { getSignatureSettings, setLocalSignatureSettings } from '../../utils/signatureController';

export const SystemSettingsManagement = () => {
    const [devMode, setDevMode] = useState(() => isDeveloperModeActive());
    const [turnstileEnabled, setTurnstileEnabled] = useState(() => window.App?.turnstile_enabled !== false);
    const [hasLiveKeys, setHasLiveKeys] = useState(() => Boolean(window.App?.turnstile_site_key));
    const [pnpkiEnabled, setPnpkiEnabled] = useState(() => getSignatureSettings().pnpki_enabled !== false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [togglingTurnstile, setTogglingTurnstile] = useState(false);
    const [togglingPnpki, setTogglingPnpki] = useState(false);
    const [notification, setNotification] = useState(null);

    const fetchSetting = async () => {
        setLoading(true);
        try {
            const [devRes, turnstileRes, sigRes] = await Promise.all([
                systemSettingService.getDeveloperMode(),
                systemSettingService.getTurnstileSettings().catch(() => null),
                systemSettingService.getSignatureSettings().catch(() => null),
            ]);

            if (devRes?.data && typeof devRes.data.developer_mode !== 'undefined') {
                const val = Boolean(devRes.data.developer_mode);
                setDevMode(val);
                setDeveloperModeActive(val);
            }

            if (turnstileRes?.data && typeof turnstileRes.data.enabled !== 'undefined') {
                const enabledVal = Boolean(turnstileRes.data.enabled);
                setTurnstileEnabled(enabledVal);
                if (typeof turnstileRes.data.has_live_keys !== 'undefined') {
                    setHasLiveKeys(Boolean(turnstileRes.data.has_live_keys));
                }
                if (window.App) {
                    window.App.turnstile_enabled = enabledVal;
                }
            }

            const sigSettings = sigRes?.data?.settings || sigRes?.data?.signature_settings;
            if (sigSettings && typeof sigSettings.pnpki_enabled !== 'undefined') {
                const pnpkiVal = Boolean(sigSettings.pnpki_enabled);
                setPnpkiEnabled(pnpkiVal);
                setLocalSignatureSettings(sigSettings);
            }
        } catch (e) {
            console.error('Failed to fetch security settings', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSetting();

        const handleDevModeChanged = (e) => {
            if (e.detail && typeof e.detail.developer_mode !== 'undefined') {
                setDevMode(Boolean(e.detail.developer_mode));
            }
        };

        const handleTurnstileChanged = (e) => {
            if (e.detail && typeof e.detail.enabled !== 'undefined') {
                setTurnstileEnabled(Boolean(e.detail.enabled));
            }
        };

        const handleSigChanged = (e) => {
            if (e.detail && typeof e.detail.pnpki_enabled !== 'undefined') {
                setPnpkiEnabled(Boolean(e.detail.pnpki_enabled));
            }
        };

        window.addEventListener('developer_mode:changed', handleDevModeChanged);
        window.addEventListener('turnstile_settings:changed', handleTurnstileChanged);
        window.addEventListener('signature_settings:changed', handleSigChanged);
        return () => {
            window.removeEventListener('developer_mode:changed', handleDevModeChanged);
            window.removeEventListener('turnstile_settings:changed', handleTurnstileChanged);
            window.removeEventListener('signature_settings:changed', handleSigChanged);
        };
    }, []);

    const handleToggle = async () => {
        const nextState = !devMode;
        setToggling(true);
        setNotification(null);

        try {
            const res = await systemSettingService.updateDeveloperMode(nextState);
            const updated = Boolean(res.data.developer_mode);
            setDevMode(updated);
            setDeveloperModeActive(updated);
            setNotification({
                type: 'success',
                message: res.data.message || `Developer Mode is now ${updated ? 'ENABLED' : 'DISABLED'}.`
            });
        } catch (e) {
            const err = e.response?.data?.message || 'Failed to update Developer Mode. Only Super Administrators are authorized.';
            setNotification({
                type: 'error',
                message: err
            });
        } finally {
            setToggling(false);
        }
    };

    const handleToggleTurnstile = async () => {
        const nextState = !turnstileEnabled;
        setTogglingTurnstile(true);
        setNotification(null);

        try {
            const res = await systemSettingService.updateTurnstileSettings(nextState);
            const updated = Boolean(res.data.enabled);
            setTurnstileEnabled(updated);
            if (window.App) {
                window.App.turnstile_enabled = updated;
            }
            window.dispatchEvent(new CustomEvent('turnstile_settings:changed', {
                detail: { enabled: updated },
            }));
            setNotification({
                type: 'success',
                message: res.data.message || `Cloudflare Security Verification is now ${updated ? 'ENABLED' : 'DISABLED'}.`,
            });
        } catch (e) {
            const err = e.response?.data?.message || 'Failed to update Cloudflare Security Verification setting. Only Super Administrators are authorized.';
            setNotification({
                type: 'error',
                message: err,
            });
        } finally {
            setTogglingTurnstile(false);
        }
    };

    const handleTogglePnpki = async () => {
        const nextState = !pnpkiEnabled;
        setTogglingPnpki(true);
        setNotification(null);

        try {
            const currentSig = getSignatureSettings();
            const res = await systemSettingService.updateSignatureSettings({
                ...currentSig,
                pnpki_enabled: nextState,
            });
            const saved = res.data?.settings || res.data?.signature_settings || { ...currentSig, pnpki_enabled: nextState };
            const updated = saved.pnpki_enabled !== false;
            setPnpkiEnabled(updated);
            setLocalSignatureSettings(saved);
            setNotification({
                type: 'success',
                message: `PNPKI Digital E-Signature System is now ${updated ? 'ENABLED' : 'DISABLED'}. ${
                    updated
                        ? 'Users can select PNPKI Digital E-Signature during registration and active PNPKI signatures display on print documents.'
                        : 'Registration now only shows Optional Digital Signature. E-signatures still display on-screen in PPMP, APP, and Detailed Specifications, but are removed on Print / Download PDF (empty signature space, no Date/Time, and no bottom certification sentence).'
                }`,
            });
        } catch (e) {
            const err = e.response?.data?.message || 'Failed to update PNPKI E-Signature setting. Only Super Administrators are authorized.';
            setNotification({
                type: 'error',
                message: err,
            });
        } finally {
            setTogglingPnpki(false);
        }
    };

    return (
        <div className="space-y-6">

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>System Security Governance</span>
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">
                            System Security, PNPKI E-Signature, Cloudflare Verification &amp; Developer Mode Control
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                            Configure platform-wide PNPKI Digital E-Signature availability, Cloudflare Turnstile human verification, developer inspection privileges, and client-side security restrictions.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchSetting}
                        disabled={loading || toggling || togglingTurnstile || togglingPnpki}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition self-start sm:self-auto cursor-pointer disabled:opacity-50"
                        title="Refresh Setting"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {notification && (
                <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-fade-in ${
                    notification.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    {notification.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span className="font-semibold leading-relaxed">{notification.message}</span>
                </div>
            )}

            <div className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-sm overflow-hidden ${
                pnpkiEnabled
                    ? 'border-indigo-400 bg-gradient-to-br from-white via-indigo-50/15 to-blue-50/25'
                    : 'border-slate-200'
            }`}>
                <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                                pnpkiEnabled
                                    ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-indigo-600/20'
                                    : 'bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-slate-500/20'
                            }`}>
                                <PenTool className="w-6 h-6" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-base font-extrabold text-slate-900">
                                        PNPKI Digital E-Signature System (Enable / Disable)
                                    </h3>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                        pnpkiEnabled
                                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${pnpkiEnabled ? 'bg-indigo-600 animate-pulse' : 'bg-slate-400'}`} />
                                        {pnpkiEnabled ? 'Enabled (PNPKI Active)' : 'Disabled (Optional Signature Only)'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                                    {pnpkiEnabled ? (
                                        <>
                                            <strong className="text-indigo-900">PNPKI E-Signature is ENABLED:</strong> During account registration and signature setup, users can choose between <strong>PNPKI Digital E-Signature</strong> and <strong>Optional Digital Signature</strong>. Valid PNPKI e-signatures display with Date/Time and certification text on PPMP print documents.
                                        </>
                                    ) : (
                                        <>
                                            <strong className="text-slate-900">PNPKI E-Signature is DISABLED:</strong> Account registration only shows the <strong>Optional Digital Signature</strong> (no option to choose PNPKI E-Sig). E-signatures still display on-screen in PPMP, APP, and Detailed Specifications, but when printing or downloading/exporting as PDF, e-signatures are removed (empty signature space), and the Date/Time and bottom certification sentence are hidden.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 lg:self-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-800 uppercase">
                                    {pnpkiEnabled ? 'Disable PNPKI E-Sig' : 'Enable PNPKI E-Sig'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {pnpkiEnabled ? 'Switch to Optional Sig Only' : 'Allow PNPKI E-Signature'}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleTogglePnpki}
                                disabled={loading || togglingPnpki}
                                className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 ${
                                    pnpkiEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                                role="switch"
                                aria-checked={pnpkiEnabled}
                                title={pnpkiEnabled ? 'Click to Disable PNPKI E-Signature System' : 'Click to Enable PNPKI E-Signature System'}
                            >
                                <span className="sr-only">Toggle PNPKI Digital E-Signature System</span>
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                        pnpkiEnabled ? 'translate-x-8' : 'translate-x-0'
                                    }`}
                                >
                                    {togglingPnpki ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                                    ) : pnpkiEnabled ? (
                                        <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                                    ) : (
                                        <PenTool className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`px-6 py-3 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    pnpkiEnabled ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>
                            {pnpkiEnabled
                                ? 'Registration shows both PNPKI E-Sig & Optional Signature. Active PNPKI signatures appear on PPMP print documents.'
                                : 'Registration shows only Optional Digital Signature. E-signatures display on-screen in PPMP, APP, and Detailed Specifications, and are automatically removed on Print / Download PDF.'}
                        </span>
                    </div>

                    <div className="font-mono text-[11px] font-semibold text-slate-500">
                        SystemSetting: pnpki_enabled
                    </div>
                </div>
            </div>

            <div className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-sm overflow-hidden ${
                turnstileEnabled
                    ? 'border-emerald-400 bg-gradient-to-br from-white via-emerald-50/15 to-teal-50/25'
                    : 'border-slate-200'
            }`}>
                <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                                turnstileEnabled
                                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-600/20'
                                    : 'bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-slate-500/20'
                            }`}>
                                {turnstileEnabled ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-base font-extrabold text-slate-900">
                                        Cloudflare Security Verification (Turnstile)
                                    </h3>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                        turnstileEnabled
                                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${turnstileEnabled ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
                                        {turnstileEnabled ? 'Enabled (Active Protection)' : 'Disabled (Bypassed)'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                        hasLiveKeys
                                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                        {hasLiveKeys ? 'Live Cloudflare Keys Configured' : 'Local Fallback Keys'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                                    {turnstileEnabled ? (
                                        <>
                                            <strong className="text-emerald-900">Cloudflare Verification is ENABLED:</strong> All users signing in or registering an account must pass the Cloudflare Turnstile human security check, and the backend cryptographically verifies the token with Cloudflare&apos;s Siteverify API.
                                        </>
                                    ) : (
                                        <>
                                            <strong className="text-slate-900">Cloudflare Verification is DISABLED:</strong> The Cloudflare Turnstile widget is hidden on the Sign In and Create Account screens, allowing users to sign in or register directly without completing a Turnstile challenge.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 lg:self-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-800 uppercase">
                                    {turnstileEnabled ? 'Disable Cloudflare' : 'Enable Cloudflare'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {turnstileEnabled ? 'Bypass on Login & Register' : 'Require Human Verification'}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleToggleTurnstile}
                                disabled={loading || togglingTurnstile}
                                className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 ${
                                    turnstileEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                                }`}
                                role="switch"
                                aria-checked={turnstileEnabled}
                                title={turnstileEnabled ? 'Click to Disable Cloudflare Security Verification' : 'Click to Enable Cloudflare Security Verification'}
                            >
                                <span className="sr-only">Toggle Cloudflare Security Verification</span>
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                        turnstileEnabled ? 'translate-x-8' : 'translate-x-0'
                                    }`}
                                >
                                    {togglingTurnstile ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                                    ) : turnstileEnabled ? (
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`px-6 py-3 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    turnstileEnabled ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>
                            {turnstileEnabled
                                ? 'Protected endpoints: POST /api/login and POST /api/register (Server-side Siteverify enforced).'
                                : 'Cloudflare Turnstile challenge is currently bypassed on both frontend forms and backend authentication.'}
                        </span>
                    </div>

                    <div className="font-mono text-[11px] font-semibold text-slate-500">
                        Audit Log: TURNSTILE_SECURITY_TOGGLED
                    </div>
                </div>
            </div>

            <div className={`bg-white rounded-2xl border-2 transition-all duration-300 shadow-sm overflow-hidden ${
                devMode
                    ? 'border-amber-400 bg-gradient-to-br from-white via-amber-50/20 to-amber-100/30'
                    : 'border-slate-200'
            }`}>
                <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                                devMode
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/20'
                                    : 'bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-slate-900/20'
                            }`}>
                                {devMode ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-base font-extrabold text-slate-900">
                                        Developer Mode / F12 Inspection Access
                                    </h3>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                        devMode
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${devMode ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'}`} />
                                        {devMode ? 'Active / Unrestricted' : 'Strict / Protected (OFF)'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                                    {devMode ? (
                                        <>
                                            <strong className="text-amber-900">Developer Mode is ON:</strong> Users and administrators can open browser Developer Tools (F12), right-click Inspect, and view developer console logs freely for maintenance, debugging, and system audits.
                                        </>
                                    ) : (
                                        <>
                                            <strong className="text-slate-900">Developer Mode is OFF (Strict Authorized Mode):</strong> Pressing F12, right-clicking Inspect, or opening browser developer tools is strictly prohibited. Any unauthorized inspection attempt immediately logs the client out and redirects back to the login screen with an unauthorized violation notice.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 lg:self-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-800 uppercase">
                                    {devMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {devMode ? 'Switch to Strict Mode' : 'Allow F12 & Inspect'}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleToggle}
                                disabled={loading || toggling}
                                className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 ${
                                    devMode ? 'bg-amber-500' : 'bg-slate-300'
                                }`}
                                role="switch"
                                aria-checked={devMode}
                                title={devMode ? 'Click to Disable Developer Mode' : 'Click to Enable Developer Mode'}
                            >
                                <span className="sr-only">Toggle Developer Mode</span>
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                        devMode ? 'translate-x-8' : 'translate-x-0'
                                    }`}
                                >
                                    {toggling ? (
                                        <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                                    ) : devMode ? (
                                        <Unlock className="w-3.5 h-3.5 text-amber-600" />
                                    ) : (
                                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`px-6 py-3 border-t text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    devMode ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>
                            {devMode
                                ? 'Developers and Super Admins may inspect elements and diagnose client network calls.'
                                : 'All user roles (End-User, Head, Reviewers, Admins) are restricted from inspecting source or DevTools.'}
                        </span>
                    </div>

                    <div className="font-mono text-[11px] font-semibold text-slate-500">
                        Audit Log: DEVELOPER_MODE_TOGGLED
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <span>F12 &amp; DevTools Inspection Rules</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                        <li><strong>F12 key:</strong> Blocked when OFF, launches DevTools when ON.</li>
                        <li><strong>Ctrl+Shift+I / J / C:</strong> Blocked when OFF, opens DevTools when ON.</li>
                        <li><strong>Right-Click Inspect:</strong> Context menu blocked when OFF, available when ON.</li>
                        <li><strong>Docked DevTools:</strong> Auto-detected and terminated when OFF.</li>
                    </ul>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                        <ShieldAlert className="w-4 h-4 text-indigo-600" />
                        <span>Security Enforcement Action</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                        <li><strong>Session Invalidation:</strong> User session is immediately revoked via API logout.</li>
                        <li><strong>Login Redirection:</strong> Client is redirected back to the login screen.</li>
                        <li><strong>Unauthorized Notice:</strong> An explicit security violation banner is displayed.</li>
                        <li><strong>Audit Trail:</strong> Setting changes are permanently logged with actor details.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsManagement;
