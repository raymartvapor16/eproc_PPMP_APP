import React, { useState, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Info,
    X,
    Check
} from 'lucide-react';

const ALERT_EVENT_NAME = 'app:show_modal_alert';

export function CustomAlertModal() {
    const [queue, setQueue] = useState([]);
    const [currentAlert, setCurrentAlert] = useState(null);
    const okButtonRef = useRef(null);

    useEffect(() => {
        const handleAlertEvent = (e) => {
            const detail = e.detail;
            if (!detail) return;
            setQueue((prev) => [...prev, detail]);
        };

        window.addEventListener(ALERT_EVENT_NAME, handleAlertEvent);
        return () => window.removeEventListener(ALERT_EVENT_NAME, handleAlertEvent);
    }, []);

    useEffect(() => {
        if (!currentAlert && queue.length > 0) {
            const next = queue[0];
            setCurrentAlert(next);
            setQueue((prev) => prev.slice(1));
        }
    }, [queue, currentAlert]);

    const handleConfirm = () => {
        if (!currentAlert) return;
        const alertToClose = currentAlert;
        setCurrentAlert(null);
        if (typeof alertToClose.onConfirm === 'function') {
            try {
                alertToClose.onConfirm();
            } catch (err) {
                console.error('Error confirming alert modal:', err);
            }
        }
    };

    const handleCancel = () => {
        if (!currentAlert) return;
        const alertToClose = currentAlert;
        setCurrentAlert(null);
        if (typeof alertToClose.onCancel === 'function') {
            try {
                alertToClose.onCancel();
            } catch (err) {
                console.error('Error canceling alert modal:', err);
            }
        } else if (typeof alertToClose.onClose === 'function') {
            try {
                alertToClose.onClose();
            } catch (err) {
                console.error('Error closing alert modal:', err);
            }
        }
    };

    useEffect(() => {
        if (currentAlert) {
            const timer = setTimeout(() => {
                okButtonRef.current?.focus();
            }, 50);

            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancel();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirm();
                }
            };

            window.addEventListener('keydown', handleKeyDown, true);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('keydown', handleKeyDown, true);
            };
        }
    }, [currentAlert]);

    if (!currentAlert) return null;

    const {
        title = 'System Notification',
        introText = '',
        bulletItems = [],
        outroText = '',
        type = 'info',
        confirmText = 'OK',
        cancelText = 'Cancel',
        isConfirm = false,
    } = currentAlert;

    const themes = {
        warning: {
            headerBg: 'bg-gradient-to-r from-slate-900 via-amber-950/80 to-slate-900',
            headerBorder: 'border-b border-amber-500/20',
            iconBox: 'bg-amber-500/20 border border-amber-400/40 text-amber-300',
            icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
            badgeBg: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
            badgeText: isConfirm ? 'Confirmation Required' : 'Validation & Action Required',
            bulletContainerBg: 'bg-amber-50/90 border border-amber-200/90',
            bulletLabelText: 'text-amber-900',
            bulletLabelIcon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
            bulletDot: 'bg-amber-500 ring-2 ring-amber-200',
            btnBg: 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-amber-600/25',
        },
        error: {
            headerBg: 'bg-gradient-to-r from-slate-900 via-rose-950/80 to-slate-900',
            headerBorder: 'border-b border-rose-500/20',
            iconBox: 'bg-rose-500/20 border border-rose-400/40 text-rose-300',
            icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
            badgeBg: 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
            badgeText: isConfirm ? 'Confirmation Notice' : 'System Notice',
            bulletContainerBg: 'bg-rose-50/90 border border-rose-200/90',
            bulletLabelText: 'text-rose-900',
            bulletLabelIcon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
            bulletDot: 'bg-rose-500 ring-2 ring-rose-200',
            btnBg: 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-rose-600/25',
        },
        danger: {
            headerBg: 'bg-gradient-to-r from-slate-900 via-rose-950/90 to-slate-900',
            headerBorder: 'border-b border-rose-500/30',
            iconBox: 'bg-rose-500/20 border border-rose-400/40 text-rose-300',
            icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
            badgeBg: 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
            badgeText: 'Irreversible Action',
            bulletContainerBg: 'bg-rose-50/90 border border-rose-200/90',
            bulletLabelText: 'text-rose-900',
            bulletLabelIcon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
            bulletDot: 'bg-rose-500 ring-2 ring-rose-200',
            btnBg: 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white shadow-rose-600/25',
        },
        success: {
            headerBg: 'bg-gradient-to-r from-slate-900 via-emerald-950/80 to-slate-900',
            headerBorder: 'border-b border-emerald-500/20',
            iconBox: 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
            badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
            badgeText: isConfirm ? 'Approval & Certification' : 'Operation Completed',
            bulletContainerBg: 'bg-emerald-50/90 border border-emerald-200/90',
            bulletLabelText: 'text-emerald-900',
            bulletLabelIcon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
            bulletDot: 'bg-emerald-500 ring-2 ring-emerald-200',
            btnBg: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-600/25',
        },
        info: {
            headerBg: 'bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950',
            headerBorder: 'border-b border-blue-500/20',
            iconBox: 'bg-blue-500/20 border border-blue-400/40 text-blue-300',
            icon: <Info className="w-5 h-5 text-blue-400" />,
            badgeBg: 'bg-blue-500/20 text-blue-300 border border-blue-400/30',
            badgeText: isConfirm ? 'Action Confirmation' : 'System Information',
            bulletContainerBg: 'bg-blue-50/90 border border-blue-200/90',
            bulletLabelText: 'text-blue-900',
            bulletLabelIcon: <Info className="w-3.5 h-3.5 text-blue-600" />,
            bulletDot: 'bg-blue-500 ring-2 ring-blue-200',
            btnBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/25',
        },
    };

    const currentTheme = themes[type] || themes.info;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleCancel();
                }
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 ring-1 ring-black/5"
                onClick={(e) => e.stopPropagation()}
            >

                <div className={`px-5 py-4 ${currentTheme.headerBg} ${currentTheme.headerBorder} text-white flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${currentTheme.iconBox}`}>
                            {currentTheme.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${currentTheme.badgeBg}`}>
                                    {currentTheme.badgeText}
                                </span>
                            </div>
                            <h2 id="custom-modal-title" className="text-base font-bold text-white tracking-tight truncate">
                                {title}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        title="Close (Esc)"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {introText && (
                        <div className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-line">
                            {introText}
                        </div>
                    )}

                    {bulletItems.length > 0 && (
                        <div className={`rounded-xl p-4 space-y-2.5 ${currentTheme.bulletContainerBg}`}>
                            <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${currentTheme.bulletLabelText}`}>
                                {currentTheme.bulletLabelIcon}
                                <span>Requirements / Checklist:</span>
                            </div>
                            <ul className="space-y-2 pl-1">
                                {bulletItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2.5 text-xs font-semibold text-slate-800 leading-normal">
                                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${currentTheme.bulletDot}`} />
                                        <span className="flex-1">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {outroText && (
                        <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="flex-1 whitespace-pre-line leading-relaxed">
                                {outroText}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    {isConfirm && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-xs cursor-pointer focus:outline-none"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        ref={okButtonRef}
                        type="button"
                        onClick={handleConfirm}
                        className={`px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${currentTheme.btnBg}`}
                    >
                        <Check className="w-4 h-4" />
                        <span>{confirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
export default CustomAlertModal;
