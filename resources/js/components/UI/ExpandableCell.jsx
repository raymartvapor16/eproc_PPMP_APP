import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const ExpandableText = ({
    text = '',
    maxLength = 65,
    className = '',
    textClassName = 'font-semibold text-slate-900',
    moreLabel = 'Show more',
    lessLabel = 'Show less',
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!text) {
        return <span className="text-slate-400 font-normal">—</span>;
    }

    const isLong = text.length > maxLength;

    if (!isLong) {
        return (
            <div className={`${textClassName} ${className} break-words`}>
                {text}
            </div>
        );
    }

    return (
        <div className={`transition-all duration-150 ${className}`}>
            <div
                className={`${textClassName} leading-snug break-words transition-all duration-150 ${
                    !isExpanded ? 'line-clamp-2' : ''
                }`}
                title={!isExpanded ? 'Click "Show more" or tap text to view full content' : undefined}
            >
                {text}
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(prev => !prev);
                }}
                className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer select-none group"
                title={isExpanded ? 'Collapse data' : 'Expand full data'}
            >
                <span>{isExpanded ? lessLabel : moreLabel}</span>
                {isExpanded ? (
                    <ChevronUp className="w-3 h-3 transition-transform group-hover:-translate-y-0.5" />
                ) : (
                    <ChevronDown className="w-3 h-3 transition-transform group-hover:translate-y-0.5" />
                )}
            </button>
        </div>
    );
};

export const ExpandableFundBadge = ({
    fund = '',
    maxLength = 24,
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!fund) {
        return <span className="text-slate-400 text-[11px]">—</span>;
    }

    const isTrust = fund.toLowerCase().includes('trust');
    const colorClasses = isTrust
        ? 'bg-teal-50 text-teal-800 border-teal-200 hover:border-teal-300 hover:bg-teal-100/60'
        : 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-300 hover:bg-blue-100/60';

    const isLong = fund.length > maxLength;

    return (
        <div className={`inline-block max-w-full ${className}`}>
            <span
                onClick={(e) => {
                    if (isLong) {
                        e.stopPropagation();
                        setIsExpanded(prev => !prev);
                    }
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all duration-200 ${colorClasses} ${
                    isLong ? 'cursor-pointer hover:shadow-2xs select-none' : ''
                } ${!isExpanded && isLong ? 'max-w-[190px]' : 'max-w-xs whitespace-normal break-words shadow-xs'}`}
                title={isLong ? (isExpanded ? 'Click to collapse fund name' : 'Click to expand full fund name') : fund}
            >
                <span className={!isExpanded && isLong ? 'truncate' : 'leading-snug'}>
                    {fund}
                </span>
                {isLong && (
                    <span className="shrink-0 text-[10px] font-bold opacity-75 ml-0.5">
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3 inline text-slate-600" />
                        ) : (
                            <ChevronDown className="w-3 h-3 inline text-slate-600" />
                        )}
                    </span>
                )}
            </span>
        </div>
    );
};
