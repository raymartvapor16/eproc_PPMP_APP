import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Generates an array of page numbers and ellipsis strings ('...')
 * e.g., 1, 2, 3, 4, 5, '...', 13
 */
export const getPaginationPages = (currentPage, totalPages) => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Near start: 1, 2, 3, 4, 5, '...', totalPages
    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
    }

    // Near end: 1, '...', totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages
    if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    // In middle: 1, '...', currentPage-1, currentPage, currentPage+1, '...', totalPages
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
};

export const PaginationControl = ({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    perPage = 10,
    onPerPageChange,
    totalEntries = 0,
    startIndex = 0,
    endIndex = 0,
    theme = 'orange',
    perPageOptions = [10, 25, 50],
}) => {
    if (totalEntries === 0) return null;

    const pages = getPaginationPages(currentPage, totalPages);
    const isOrange = theme === 'orange';

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
                <span>
                    Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
                    <span className="font-bold text-slate-800">{Math.min(endIndex, totalEntries)}</span> of{' '}
                    <span className="font-bold text-slate-800">{totalEntries}</span> entries
                </span>

                {onPerPageChange && totalEntries > 10 && (
                    <div className="flex items-center gap-1.5 ml-2">
                        <span>Show:</span>
                        <select
                            value={perPage}
                            onChange={(e) => {
                                onPerPageChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            className={`py-1 px-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 cursor-pointer text-xs ${
                                isOrange ? 'focus:ring-orange-500 focus:border-orange-500' : 'focus:ring-blue-500 focus:border-blue-500'
                            }`}
                        >
                            {perPageOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt} rows
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                        className={`p-1.5 rounded-lg border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isOrange
                                ? 'border-slate-300 bg-white hover:bg-orange-50 hover:text-orange-700 text-slate-700'
                                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Previous Page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 px-1">
                        {pages.map((p, idx) => {
                            if (p === '...') {
                                return (
                                    <span
                                        key={`ellipsis-${idx}`}
                                        className="px-1.5 py-1 text-slate-400 font-bold tracking-widest select-none text-xs"
                                    >
                                        ...
                                    </span>
                                );
                            }

                            const isActive = currentPage === p;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => onPageChange(p)}
                                    className={`min-w-[32px] h-8 px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                                        isActive
                                            ? isOrange
                                                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm shadow-orange-500/25 border border-orange-500'
                                                : 'bg-blue-600 text-white shadow-xs'
                                            : isOrange
                                            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                        className={`p-1.5 rounded-lg border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isOrange
                                ? 'border-slate-300 bg-white hover:bg-orange-50 hover:text-orange-700 text-slate-700'
                                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Next Page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};
export default PaginationControl;
