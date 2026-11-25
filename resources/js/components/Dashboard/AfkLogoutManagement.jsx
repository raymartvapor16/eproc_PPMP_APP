import React, { useState, useEffect } from 'react';
import {
    Clock,
    Shield,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Sliders,
    Power,
    Timer,
    Info,
    Save,
    Loader2,
    Lock,
} from 'lucide-react';
import { systemSettingService } from '../../services/api';

export const AfkLogoutManagement = () => {
    const [enabled, setEnabled] = useState(true);
    const [timeoutMinutes, setTimeoutMinutes] = useState(15);
    const [warningSeconds, setWarningSeconds] = useState(60);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await systemSettingService.getAfkSettings();
            if (res.data) {
                setEnabled(Boolean(res.data.enabled));
                setTimeoutMinutes(Number(res.data.timeout_minutes) || 15);
                setWarningSeconds(Number(res.data.warning_seconds) || 60);
            }
        } catch (err) {
            console.error('Failed to fetch AFK auto-logout settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();

        const handleUpdate = () => fetchSettings();
        window.addEventListener('afk_settings:updated', handleUpdate);
        return () => window.removeEventListener('afk_settings:updated', handleUpdate);
    }, []);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setFeedback(null);

        try {
            const payload = {
                enabled: Boolean(enabled),
                timeout_minutes: Math.max(1, Math.min(480, Number(timeoutMinutes) || 15)),
                warning_seconds: Math.max(10, Math.min(300, Number(warningSeconds) || 60)),
            };

            const res = await systemSettingService.updateAfkSettings(payload);
            setFeedback({
                type: 'success',
                message: res.data.message || 'AFK Inactivity Auto-Logout configuration updated successfully.',
            });

            window.dispatchEvent(new CustomEvent('afk_settings:updated', { detail: payload }));
        } catch (err) {
            setFeedback({
                type: 'error',
                message: err.response?.data?.message || 'Failed to update AFK Auto-Logout settings.',
            });
        } finally {
            setSaving(false);
        }
    };

    const presetMinutes = [5, 10, 15, 30, 60];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">

            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        AFK Inactivity &amp; Auto-Logout Security Management
                    </h3>
                </div>
                <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                >
                    {enabled ? `Active (${timeoutMinutes} min)` : 'Disabled'}
                </span>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
                {feedback && (
                    <div
                        className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                            feedback.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border border-rose-200 text-rose-800'
                        }`}
                    >
                        {feedback.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{feedback.message}</span>
                    </div>
                )}

                {loading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs font-semibold">Loading AFK security configuration...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-6">

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70 gap-4">
                            <div className="flex items-start gap-3">
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        enabled
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-200 text-slate-500'
                                    }`}
                                >
                                    <Power className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-900">
                                            Enable AFK Inactivity Auto-Logout
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                            Platform-Wide
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                                        When enabled, users with no keyboard, mouse, touch, or navigation activity will be automatically logged out after the configured idle duration.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setEnabled(!enabled)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                    enabled ? 'bg-emerald-600' : 'bg-slate-300'
                                }`}
                                role="switch"
                                aria-checked={enabled}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                        enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className={`space-y-4 transition ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <label
                                    htmlFor="afk-timeout-minutes"
                                    className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                                >
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Inactivity Timeout Duration (AFK Minutes)</span>
                                </label>
                                <p className="text-xs text-slate-500 mb-3">
                                    Choose from standard security presets or specify custom inactivity minutes before auto-logout is initiated.
                                </p>

                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    {presetMinutes.map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setTimeoutMinutes(mins)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                                Number(timeoutMinutes) === mins
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {mins} Minutes {mins === 15 && '(Standard)'}
                                        </button>
                                    ))}
                                </div>

                                <div className="max-w-xs">
                                    <div className="relative rounded-lg shadow-2xs">
                                        <input
                                            id="afk-timeout-minutes"
                                            name="afk_timeout_minutes"
                                            type="number"
                                            min="1"
                                            max="480"
                                            value={timeoutMinutes}
                                            onChange={(e) => setTimeoutMinutes(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter minutes (1 - 480)"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400 font-semibold">
                                            Minutes
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Recommended: 15 minutes for maximum terminal security.</p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label
                                    htmlFor="afk-warning-seconds"
                                    className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Pre-Logout Warning Countdown Window</span>
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    Seconds before auto-logout when an interactive countdown dialog appears, allowing active staff to click "Stay Logged In".
                                </p>

                                <div className="max-w-xs">
                                    <select
                                        id="afk-warning-seconds"
                                        name="afk_warning_seconds"
                                        value={warningSeconds}
                                        onChange={(e) => setWarningSeconds(Number(e.target.value))}
                                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="30">30 Seconds Warning</option>
                                        <option value="60">60 Seconds (1 Minute Standard)</option>
                                        <option value="120">120 Seconds (2 Minutes)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="font-bold">Security Protection Policy:</p>
                                <p className="text-amber-800 text-[11px] leading-relaxed">
                                    Monitored inputs include mouse clicks, cursor motion, keyboard typing, page scrolling, and touch interaction. When the timer elapses, the session is cleared securely on both client and server to prevent physical tampering on unattended office computers.
                                </p>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={fetchSettings}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
                            >
                                Reset
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Saving Settings...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Save AFK Logout Configuration</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
