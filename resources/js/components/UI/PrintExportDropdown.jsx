import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, ChevronDown, Loader2 } from 'lucide-react';

export const PrintExportDropdown = ({
    label = 'Print / Download PDF',
    onPrint,
    onDownloadPdf,
    printLabel = 'Print Document',
    printSublabel = 'Open browser print dialog',
    downloadLabel = 'Download PDF',
    downloadSublabel = 'Export and save as .pdf file',
    extraOptions = null,
    isExporting = false,
    disabled = false,
    buttonClassName = 'flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition cursor-pointer',
    menuWidth = 240,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const estimatedMenuHeight = extraOptions ? 220 : 124;
        const margin = 8;

        let left = rect.right - menuWidth;
        if (left < margin) {
            left = margin;
        }
        if (left + menuWidth > viewportW - margin) {
            left = Math.max(margin, viewportW - menuWidth - margin);
        }

        let top = rect.bottom + 6;
        if (top + estimatedMenuHeight > viewportH - margin && rect.top > estimatedMenuHeight + margin) {
            top = Math.max(margin, rect.top - estimatedMenuHeight - 6);
        }

        setMenuPos({ top, left });
    }, [menuWidth, extraOptions]);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();

        const handleOutsideClick = (e) => {
            if (
                triggerRef.current &&
                !triggerRef.current.contains(e.target) &&
                menuRef.current &&
                !menuRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    const handleSelect = (action) => {
        setIsOpen(false);
        if (typeof action === 'function') {
            action();
        }
    };

    return (
        <div className="relative inline-block no-print">
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled || isExporting}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`${buttonClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                    <Printer className="w-4 h-4 shrink-0" />
                )}
                <span>{isExporting ? 'Exporting PDF...' : label}</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        style={{
                            position: 'fixed',
                            top: `${menuPos.top}px`,
                            left: `${menuPos.left}px`,
                            width: `${menuWidth}px`,
                            zIndex: 9999,
                        }}
                        className="no-print bg-white rounded-xl border border-slate-200 shadow-2xl py-1.5 text-left ring-1 ring-slate-900/5 animate-fade-in"
                    >
                        {Array.isArray(extraOptions) && extraOptions.length > 0 ? (
                            extraOptions.map((opt, idx) => {
                                if (opt.divider) {
                                    return <div key={`div-${idx}`} className="my-1 border-t border-slate-100" />;
                                }
                                const Icon = opt.icon || Printer;
                                return (
                                    <button
                                        key={opt.key || idx}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleSelect(opt.onClick)}
                                        className="w-full px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 active:bg-slate-100 transition text-left cursor-pointer"
                                    >
                                        <span className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${opt.iconBg || 'bg-blue-50 text-blue-600'}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-xs font-bold text-slate-900 leading-tight">
                                                {opt.label}
                                            </span>
                                            {opt.sublabel && (
                                                <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                                                    {opt.sublabel}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })
                        ) : (
                            <>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleSelect(onPrint)}
                                    className="w-full px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 active:bg-slate-100 transition text-left cursor-pointer"
                                >
                                    <span className="mt-0.5 p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                        <Printer className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-bold text-slate-900 leading-tight">
                                            {printLabel}
                                        </span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                                            {printSublabel}
                                        </span>
                                    </span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleSelect(onDownloadPdf)}
                                    className="w-full px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-emerald-50/70 active:bg-emerald-50 transition text-left cursor-pointer"
                                >
                                    <span className="mt-0.5 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                                        <Download className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-bold text-slate-900 leading-tight">
                                            {downloadLabel}
                                        </span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                                            {downloadSublabel}
                                        </span>
                                    </span>
                                </button>
                            </>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default PrintExportDropdown;
