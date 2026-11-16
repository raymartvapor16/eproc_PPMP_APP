import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, AlertTriangle, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';
import { systemSettingService } from '../../services/api';

/**
 * AfkInactivityGuard:
 * Monitors platform user activity across mouse, keyboard, touch, and scrolling events.
 * Automatically initiates session termination when a user is AFK/inactive for the configured duration
 * (Default: 15 minutes), displaying a countdown warning window prior to logout.
 */
export const AfkInactivityGuard = ({ user = null, onLogout }) => {
    const [settings, setSettings] = useState({
        enabled: true,
        timeoutMinutes: 15,
        warningSeconds: 60,
    });
    const [secondsRemaining, setSecondsRemaining] = useState(60);
    const [isWarningOpen, setIsWarningOpen] = useState(false);

    const lastActivityRef = useRef(Date.now());
    const isLoggingOutRef = useRef(false);

    // Fetch platform AFK logout settings
    const loadSettings = useCallback(async () => {
        if (!user) return;
        try {
            const res = await systemSettingService.getAfkSettings();
            if (res.data) {
                setSettings({
                    enabled: Boolean(res.data.enabled),
                    timeoutMinutes: Math.max(1, Number(res.data.timeout_minutes) || 15),
                    warningSeconds: Math.max(10, Number(res.data.warning_seconds) || 60),
                });
            }
        } catch (err) {
            console.error('Failed to load AFK settings, using standard 15-minute defaults:', err);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        loadSettings();

        const handleSettingsUpdate = (e) => {
            if (e.detail) {
                setSettings({
                    enabled: Boolean(e.detail.enabled),
                    timeoutMinutes: Math.max(1, Number(e.detail.timeout_minutes) || 15),
                    warningSeconds: Math.max(10, Number(e.detail.warning_seconds) || 60),
                });
            } else {
                loadSettings();
            }
        };

        window.addEventListener('afk_settings:updated', handleSettingsUpdate);
        return () => window.removeEventListener('afk_settings:updated', handleSettingsUpdate);
    }, [user, loadSettings]);

    // Handle user interaction to reset inactivity timer
    const recordUserActivity = useCallback(() => {
        // If warning dialog is currently active, user must explicitly click "Stay Logged In"
        if (isWarningOpen) return;
        lastActivityRef.current = Date.now();
    }, [isWarningOpen]);

    // Attach passive event listeners to window
    useEffect(() => {
        if (!user || !settings.enabled) return;

        let lastThrottledTime = 0;
        const throttledListener = () => {
            const now = Date.now();
            if (now - lastThrottledTime > 1000) {
                lastThrottledTime = now;
                recordUserActivity();
            }
        };

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
        events.forEach((ev) => window.addEventListener(ev, throttledListener, { passive: true }));

        return () => {
            events.forEach((ev) => window.removeEventListener(ev, throttledListener));
        };
    }, [user, settings.enabled, recordUserActivity]);

    // Master inactivity checker running every 1 second
    useEffect(() => {
        if (!user || !settings.enabled) {
            setIsWarningOpen(false);
            return;
        }

        const interval = setInterval(() => {
            if (isLoggingOutRef.current) return;

            const now = Date.now();
            const elapsedSeconds = Math.floor((now - lastActivityRef.current) / 1000);
            const totalTimeoutSeconds = settings.timeoutMinutes * 60;
            const remaining = totalTimeoutSeconds - elapsedSeconds;

            // 1. Timeout reached -> Perform Automatic Logout
            if (remaining <= 0) {
                isLoggingOutRef.current = true;
                setIsWarningOpen(false);
                clearInterval(interval);

                // Notify user and execute logout
                alert(`Security Session Timeout: You have been automatically logged out due to inactivity (${settings.timeoutMinutes} minutes AFK).`);
                if (onLogout) {
                    onLogout();
                }
                return;
            }

            // 2. Warning Threshold reached -> Open Countdown Warning Modal
            if (remaining <= settings.warningSeconds) {
                setSecondsRemaining(remaining);
                setIsWarningOpen(true);
            } else {
                if (isWarningOpen) {
                    setIsWarningOpen(false);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [user, settings, isWarningOpen, onLogout]);

    // User chooses to stay logged in
    const handleStayLoggedIn = () => {
        lastActivityRef.current = Date.now();
        setIsWarningOpen(false);
    };

    // User chooses to log out immediately
    const handleLogoutNow = () => {
        isLoggingOutRef.current = true;
        setIsWarningOpen(false);
        if (onLogout) {
            onLogout();
        }
    };

    if (!user || !isWarningOpen || !settings.enabled) return null;

    // Format remaining time as MM:SS
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-center animate-in zoom-in-95 duration-150">
                {/* Header Strip */}
                <div className="p-4 bg-amber-500 text-slate-950 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
                    <span>Inactivity Warning &bull; Terminal AFK Detected</span>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                    {/* Pulsing Timer Graphic */}
                    <div className="relative mx-auto w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                        <Timer className="w-10 h-10 animate-pulse" />
                        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white font-mono text-xs font-black flex items-center justify-center shadow-md animate-bounce">
                            !
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Are you still working here?
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                            You have been inactive for over{' '}
                            <strong className="text-slate-900 font-bold">
                                {settings.timeoutMinutes} minutes
                            </strong>
                            . To protect provincial procurement records, your session will automatically terminate in:
                        </p>
                    </div>

                    {/* Countdown Display Box */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white font-mono font-black text-3xl tracking-widest border border-slate-800 shadow-inner flex items-center justify-center gap-2">
                        <span className="text-amber-400">{formattedTime}</span>
                        <span className="text-xs font-sans text-slate-400 font-bold tracking-normal uppercase ml-1">
                            seconds
                        </span>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                        Click "Stay Logged In" to extend your active session and continue working.
                    </p>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleStayLoggedIn}
                            className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer ring-2 ring-blue-500/30"
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                            <span>Stay Logged In</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleLogoutNow}
                            className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <LogOut className="w-3.5 h-3.5 text-slate-500" />
                            <span>Log Out Now</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

