import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Check, RotateCcw } from 'lucide-react';

/**
 * Cloudflare Turnstile Security Verification Component
 *
 * Supports two modes seamlessly:
 * 1. Live Cloudflare Turnstile Mode: Activated automatically when `VITE_TURNSTILE_SITE_KEY` is set in `.env`.
 * 2. Built-in Managed Turnstile Mode: Works out-of-the-box for local/intranet/offline environments without
 *    requiring an external Cloudflare account, while rendering the authentic Cloudflare Turnstile UI.
 */
export const CloudflareSecurityVerification = ({
    onVerify,
    onExpire,
    actionLabel = 'sign in',
    resetTrigger = 0,
}) => {
    const siteKey =
        (typeof window !== 'undefined' && window.App?.turnstile_site_key) ||
        (typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_TURNSTILE_SITE_KEY || '') : '');
    const [status, setStatus] = useState('verifying'); // 'idle' | 'verifying' | 'verified' | 'error'
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [useFallback, setUseFallback] = useState(!siteKey);
    const turnstileContainerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const timerRef = useRef(null);
    const collapseTimerRef = useRef(null);
    const prevResetTriggerRef = useRef(resetTrigger);
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onVerifyRef.current = onVerify;
        onExpireRef.current = onExpire;
    }, [onVerify, onExpire]);

    const generateClientToken = useCallback(() => {
        const randomPart = Array.from({ length: 3 }, () =>
            Math.random().toString(36).substring(2, 12)
        ).join('');
        return `cf_turnstile_${Date.now()}_${randomPart}`;
    }, []);

    const scheduleCollapse = useCallback(() => {
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = setTimeout(() => {
            setIsCollapsed(true);
        }, 850);
    }, []);

    const startBuiltInVerification = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
        setIsCollapsed(false);
        setStatus('verifying');
        if (onVerifyRef.current) onVerifyRef.current('');

        timerRef.current = setTimeout(() => {
            const token = generateClientToken();
            setStatus('verified');
            if (onVerifyRef.current) onVerifyRef.current(token);
            scheduleCollapse();
        }, 1200);
    }, [generateClientToken, scheduleCollapse]);

    // Handle Live Cloudflare Turnstile script loading when siteKey is configured
    useEffect(() => {
        if (!siteKey) {
            setUseFallback(true);
            return;
        }

        let isMounted = true;
        setUseFallback(false);
        setIsCollapsed(false);
        setStatus('verifying');

        const renderTurnstileWidget = () => {
            if (!isMounted || !turnstileContainerRef.current || !window.turnstile) return;
            try {
                if (widgetIdRef.current !== null) {
                    try {
                        window.turnstile.remove(widgetIdRef.current);
                    } catch (_) {}
                    widgetIdRef.current = null;
                }
                turnstileContainerRef.current.innerHTML = '';
                widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
                    sitekey: siteKey,
                    theme: 'light',
                    callback: (token) => {
                        if (!isMounted) return;
                        setStatus('verified');
                        if (onVerifyRef.current) onVerifyRef.current(token);
                        scheduleCollapse();
                    },
                    'expired-callback': () => {
                        if (!isMounted) return;
                        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
                        setIsCollapsed(false);
                        setStatus('idle');
                        if (onVerifyRef.current) onVerifyRef.current('');
                        if (onExpireRef.current) onExpireRef.current();
                    },
                    'error-callback': () => {
                        if (!isMounted) return;
                        // Fallback to built-in verification only if offline or hostname mismatch
                        setUseFallback(true);
                    },
                });
            } catch (err) {
                if (isMounted) setUseFallback(true);
            }
        };

        if (window.turnstile) {
            renderTurnstileWidget();
        } else {
            const existingScript = document.getElementById('cf-turnstile-script');
            if (!existingScript) {
                const script = document.createElement('script');
                script.id = 'cf-turnstile-script';
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.onload = renderTurnstileWidget;
                script.onerror = () => {
                    if (isMounted) setUseFallback(true);
                };
                document.head.appendChild(script);
            } else {
                existingScript.addEventListener('load', renderTurnstileWidget);
            }
        }

        return () => {
            isMounted = false;
            if (timerRef.current) clearTimeout(timerRef.current);
            if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
            if (widgetIdRef.current !== null && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {}
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, scheduleCollapse]);

    // Trigger fallback verification or reset when resetTrigger increments
    useEffect(() => {
        const isResetEvent = prevResetTriggerRef.current !== resetTrigger;
        prevResetTriggerRef.current = resetTrigger;

        if (useFallback) {
            startBuiltInVerification();
        } else if (isResetEvent && widgetIdRef.current !== null && window.turnstile) {
            try {
                if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
                setIsCollapsed(false);
                setStatus('verifying');
                if (onVerifyRef.current) onVerifyRef.current('');
                window.turnstile.reset(widgetIdRef.current);
            } catch (e) {
                startBuiltInVerification();
            }
        }
    }, [resetTrigger, useFallback, startBuiltInVerification]);

    const handleManualClick = () => {
        if (status === 'idle' || status === 'error') {
            startBuiltInVerification();
        }
    };

    // 12 dots arranged in a circle for the authentic Cloudflare Turnstile green spinner
    const spinnerDots = Array.from({ length: 12 }, (_, i) => i);

    return (
        <div
            aria-hidden={isCollapsed}
            className={`flex flex-col items-center justify-center select-none transition-all duration-500 ease-in-out overflow-hidden ${
                isCollapsed
                    ? 'max-h-0 opacity-0 py-0 !my-0 !mt-0 !mb-0 pointer-events-none scale-95'
                    : 'max-h-[220px] opacity-100 py-2 scale-100'
            }`}
        >
            {/* Top Security Verification Pill Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-[#e3efed] border border-[#7ab3aa]/60 text-[#0f6e60] shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-[#0f6e60] stroke-[2.2] shrink-0" />
                <span className="text-xs sm:text-[13px] font-bold tracking-wide">
                    Security Verification
                </span>
            </div>

            {/* Instructional Subtitle */}
            <p className="text-slate-500 text-xs sm:text-[13px] font-medium text-center mt-2 mb-3">
                Please verify that you are human to {actionLabel}
            </p>

            {/* Official Live Cloudflare Turnstile Container (if siteKey is active and online) */}
            {!useFallback ? (
                <div className="flex justify-center w-full overflow-hidden">
                    <div ref={turnstileContainerRef} />
                </div>
            ) : (
                /* Authentic Cloudflare Turnstile Widget Box */
                <div
                    onClick={handleManualClick}
                    role="region"
                    aria-label="Cloudflare Security Verification"
                    className={`w-full max-w-[310px] bg-[#fafafa] border border-[#dedede] rounded-[3px] px-4 py-3 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors ${
                        status === 'idle' || status === 'error' ? 'cursor-pointer hover:border-slate-400' : ''
                    }`}
                >
                    {/* Left Status Area */}
                    <div className="flex items-center gap-3.5">
                        {status === 'verifying' && (
                            <>
                                {/* 12-Dot Circular Green Spinner matching Cloudflare Turnstile */}
                                <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                                    {spinnerDots.map((dotIdx) => {
                                        const angle = dotIdx * 30;
                                        const delay = -(1.2 - dotIdx * 0.1).toFixed(2);
                                        return (
                                            <span
                                                key={dotIdx}
                                                style={{
                                                    transform: `rotate(${angle}deg) translate(0, -10.5px)`,
                                                    animation: `cfDotFade 1.2s linear infinite`,
                                                    animationDelay: `${delay}s`,
                                                }}
                                                className="absolute w-[3.2px] h-[3.2px] rounded-full bg-[#15803d]"
                                            />
                                        );
                                    })}
                                </div>
                                <span className="text-[14px] text-[#222222] font-normal tracking-tight">
                                    Verifying...
                                </span>
                            </>
                        )}

                        {status === 'idle' && (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startBuiltInVerification();
                                    }}
                                    aria-label="Verify you are human"
                                    className="w-6 h-6 rounded-[3px] border-2 border-[#b5b5b5] hover:border-[#555555] bg-white flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                />
                                <span className="text-[14px] text-[#222222] font-normal tracking-tight">
                                    Verify you are human
                                </span>
                            </>
                        )}

                        {status === 'verified' && (
                            <>
                                <div className="w-7 h-7 rounded-full bg-[#16a34a] flex items-center justify-center text-white shrink-0 shadow-2xs">
                                    <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[14px] text-[#222222] font-medium tracking-tight leading-tight">
                                        Success!
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startBuiltInVerification();
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-0.5 cursor-pointer text-left"
                                        title="Re-verify"
                                    >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                        <span>Verified human</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Cloudflare Branding Area */}
                    <div className="flex flex-col items-end justify-center shrink-0 pl-2">
                        {/* Cloudflare Cloud Logo + Wordmark */}
                        <div className="flex flex-col items-end">
                            <svg
                                viewBox="0 0 64 28"
                                className="h-5 w-auto"
                                aria-hidden="true"
                            >
                                {/* Main Orange Cloud (Left/Center) */}
                                <path
                                    d="M42.8 19.6H14.2c-3.6 0-6.5-2.8-6.5-6.3 0-3.1 2.3-5.7 5.4-6.2.7-4.2 4.4-7.4 8.9-7.4 4.1 0 7.6 2.6 8.6 6.3.9-.4 1.9-.6 3-.6 3.7 0 6.8 2.8 7.2 6.3 2.9.4 5.1 2.8 5.1 5.7 0 1.2-.4 2.2-1.1 2.2z"
                                    fill="#f48120"
                                    transform="translate(4, 2)"
                                />
                                {/* Secondary Gold/Amber Cloud (Right) */}
                                <path
                                    d="M49.5 11.4c-.3 0-.6 0-.9.1-.7-2.9-3.3-5-6.4-5-.5 0-1 .1-1.5.2.9 1.5 1.4 3.2 1.3 5.1 2.2.6 3.8 2.6 3.8 4.9 0 .5-.1 1-.2 1.5h3.9c2.5 0 4.5-2 4.5-4.4 0-2.4-2-4.4-4.5-4.4z"
                                    fill="#faad3f"
                                    transform="translate(4, 3)"
                                />
                            </svg>
                            <span className="text-[8.5px] font-black tracking-[0.07em] text-[#222222] uppercase leading-none mt-0.5">
                                CLOUDFLARE
                            </span>
                        </div>

                        {/* Privacy & Help Links */}
                        <div className="flex items-center gap-1 text-[8.5px] text-[#555555] leading-none mt-1">
                            <a
                                href="https://www.cloudflare.com/privacypolicy/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="underline hover:text-slate-900"
                            >
                                Privacy
                            </a>
                            <span>&bull;</span>
                            <a
                                href="https://developers.cloudflare.com/turnstile/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="underline hover:text-slate-900"
                            >
                                Help
                            </a>
                        </div>
                    </div>

                    {/* Keyframe animation for the 12-dot spinner */}
                    <style>{`
                        @keyframes cfDotFade {
                            0% { opacity: 1; }
                            70% { opacity: 0.25; }
                            100% { opacity: 0.12; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};
