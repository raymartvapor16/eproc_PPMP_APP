import React from 'react';

/**
 * Formats a month or date string (e.g. "2026-01", "2026-01 - 2026-02", "1/2026", "1/2026 - 2/2026") into "M/YYYY" or "M/YYYY - M/YYYY" format.
 */
export const formatSingleMonthYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (!str) return '';
    // Match YYYY-MM or YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const [, year, month] = isoMatch;
        return `${parseInt(month, 10)}/${year}`;
    }
    // Match MM/YYYY or M/YYYY
    const myMatch = str.match(/^(\d{1,2})\/(\d{4})/);
    if (myMatch) {
        const [, month, year] = myMatch;
        return `${parseInt(month, 10)}/${year}`;
    }
    return str;
};

export const formatMonthYear = (val) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (!str) return '—';

    // Check if it's a range (separated by ' - ' or ' to ' or ',')
    if (str.includes(' - ') || str.includes(' to ')) {
        const parts = str.includes(' - ') ? str.split(' - ') : str.split(' to ');
        const start = formatSingleMonthYear(parts[0]);
        const end = formatSingleMonthYear(parts[1]);
        if (start && end) {
            return `${start} - ${end}`;
        }
        return start || end || '—';
    }

    const formatted = formatSingleMonthYear(str);
    return formatted || str;
};

/**
 * Normalizes input value for single month <input type="month"> (YYYY-MM).
 */
export const toSingleMonthInputValue = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const [, year, month] = isoMatch;
        return `${year}-${month.padStart(2, '0')}`;
    }
    const myMatch = str.match(/^(\d{1,2})\/(\d{4})/);
    if (myMatch) {
        const [, month, year] = myMatch;
        return `${year}-${month.padStart(2, '0')}`;
    }
    return '';
};

/**
 * Splits a stored date value (which could be single "1/2026" or range "1/2026 - 2/2026")
 * into { start: 'YYYY-MM', end: 'YYYY-MM' } for inputs.
 */
export const parseMonthRangeValue = (val) => {
    if (!val) return { start: '', end: '' };
    const str = String(val).trim();
    if (str.includes(' - ')) {
        const parts = str.split(' - ');
        return {
            start: toSingleMonthInputValue(parts[0]),
            end: toSingleMonthInputValue(parts[1])
        };
    }
    if (str.includes(' to ')) {
        const parts = str.split(' to ');
        return {
            start: toSingleMonthInputValue(parts[0]),
            end: toSingleMonthInputValue(parts[1])
        };
    }
    return {
        start: toSingleMonthInputValue(str),
        end: ''
    };
};

/**
 * Combines startMonth (YYYY-MM) and optional endMonth (YYYY-MM) into standard string representation e.g. "1/2026" or "1/2026 - 2/2026".
 */
export const combineMonthRangeValue = (startVal, endVal) => {
    const startFormatted = formatSingleMonthYear(startVal);
    const endFormatted = formatSingleMonthYear(endVal);
    if (startFormatted && endFormatted) {
        return `${startFormatted} - ${endFormatted}`;
    }
    return startFormatted || endFormatted || '';
};

export const toMonthInputValue = (val) => {
    return parseMonthRangeValue(val).start;
};

/**
 * Compact, clean Month / Month Range input component:
 * Allows user to pick a primary month (e.g. 1/2026), with an optional secondary month (e.g. 2/2026)
 * to form a range like "1/2026 - 2/2026", or just keep single "1/2026".
 */
export const MonthRangeInput = ({ value, onChange, className = "" }) => {
    const { start, end } = parseMonthRangeValue(value);
    const [hasRange, setHasRange] = React.useState(Boolean(end));

    // Keep internal range toggle synced if value prop changes
    React.useEffect(() => {
        if (end) {
            setHasRange(true);
        }
    }, [end]);

    const handleStartChange = (newStart) => {
        const combined = combineMonthRangeValue(newStart, hasRange ? end : '');
        onChange(combined);
    };

    const handleEndChange = (newEnd) => {
        const combined = combineMonthRangeValue(start, newEnd);
        onChange(combined);
    };

    const toggleRange = () => {
        if (hasRange) {
            // Remove range, keep only start
            setHasRange(false);
            onChange(combineMonthRangeValue(start, ''));
        } else {
            // Enable range
            setHasRange(true);
        }
    };

    return (
        <div className={`flex flex-col items-center gap-1 min-w-[125px] ${className}`}>
            <input
                type="month"
                value={start || ''}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full text-[11px] p-1 border border-slate-300 rounded text-center bg-white shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                title="Select month"
            />
            
            {hasRange ? (
                <div className="w-full flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 select-none">-</span>
                    <input
                        type="month"
                        value={end || ''}
                        onChange={(e) => handleEndChange(e.target.value)}
                        className="w-full text-[11px] p-1 border border-blue-300 bg-blue-50/50 rounded text-center shadow-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        title="Select end month (optional range)"
                    />
                    <button
                        type="button"
                        onClick={toggleRange}
                        className="text-[10px] text-slate-400 hover:text-rose-600 px-1 py-0.5 rounded transition"
                        title="Remove range (single month only)"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={toggleRange}
                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition select-none"
                    title="Add optional end month for range (e.g. 1/2026 - 2/2026)"
                >
                    + range
                </button>
            )}
        </div>
    );
};

