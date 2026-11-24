import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn } from 'lucide-react';

export const ResponsivePrintDocument = ({
    children,
    paperWidth = 1200,
    className = '',
}) => {
    const outerRef = useRef(null);
    const innerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(paperWidth);
    const [innerHeight, setInnerHeight] = useState(0);
    const [viewMode, setViewMode] = useState('fit');

    useEffect(() => {
        const updateMeasurements = () => {
            if (outerRef.current) {
                setContainerWidth(outerRef.current.clientWidth || window.innerWidth);
            }
            if (innerRef.current) {
                setInnerHeight(innerRef.current.scrollHeight || 0);
            }
        };

        updateMeasurements();

        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMeasurements) : null;
        if (ro) {
            if (outerRef.current) ro.observe(outerRef.current);
            if (innerRef.current) ro.observe(innerRef.current);
        }
        window.addEventListener('resize', updateMeasurements);

        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', updateMeasurements);
        };
    }, [paperWidth, viewMode]);

    const isNarrow = containerWidth > 0 && containerWidth < paperWidth - 20;
    const isFitScaled = isNarrow && viewMode === 'fit';
    const scale = isFitScaled ? Math.max(0.22, Math.min(1, containerWidth / paperWidth)) : 1;

    return (
        <div className={`w-full ${className}`}>
            <style>{`
                @media print {
                    .responsive-print-outer {
                        height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    .responsive-print-inner {
                        width: 100% !important;
                        min-width: 0 !important;
                        transform: none !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            {isNarrow && (
                <div className="no-print bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-600">
                        Document View:
                    </span>
                    <div className="inline-flex rounded-lg bg-white border border-slate-300 p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('fit')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                viewMode === 'fit'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Maximize2 className="w-3 h-3" />
                            <span>Whole Page</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('actual')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                viewMode === 'actual'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <ZoomIn className="w-3 h-3" />
                            <span>100% Scroll</span>
                        </button>
                    </div>
                </div>
            )}

            <div
                ref={outerRef}
                className={`responsive-print-outer w-full ${
                    isFitScaled
                        ? 'overflow-hidden bg-slate-100/70'
                        : isNarrow
                            ? 'overflow-x-auto bg-slate-100/70'
                            : ''
                }`}
                style={
                    isFitScaled && innerHeight > 0
                        ? { height: `${Math.ceil(innerHeight * scale) + 8}px` }
                        : undefined
                }
            >
                <div
                    ref={innerRef}
                    className={`responsive-print-inner bg-white ${isNarrow ? 'shadow-sm' : ''}`}
                    style={
                        isFitScaled
                            ? {
                                width: `${paperWidth}px`,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                            }
                            : isNarrow
                                ? { width: `${paperWidth}px` }
                                : undefined
                    }
                >
                    {children}
                </div>
            </div>
        </div>
    );
};
