import React, { useRef } from 'react';
import { CellCommentPopover } from './CellCommentPopover';

export const CommentableCell = ({
    as = 'td',
    itemId = null,
    itemNo = null,
    fieldKey,
    fieldLabel,
    cellValue,
    contextData = null,
    comments = [],
    changeLogs = [],
    canComment = false,
    canComply = false,
    currentUser = null,
    activeCellKey,
    setActiveCellKey,
    onAddCellComment,
    onDeleteCellComment,
    onComplyCellComment,
    onUncomplyCellComment,
    onUpdateCellValue = null,
    className = '',
    children,
}) => {
    const cellKey = `cell-${itemNo || itemId || 'field'}-${fieldKey}`;
    const cellRef = useRef(null);
    const matchingComments = comments.filter((c) => {
        if (itemId || itemNo) {
            const matchesId = itemId && c.item_id && String(c.item_id) === String(itemId);
            const matchesNo = itemNo !== undefined && itemNo !== null && c.item_no !== undefined && c.item_no !== null && Number(c.item_no) === Number(itemNo);
            return (matchesId || matchesNo) && c.field_key === fieldKey;
        }
        return !c.item_id && (c.item_no === null || c.item_no === undefined) && c.field_key === fieldKey;
    });

    const pendingComments = matchingComments.filter((c) => c.status === 'pending');
    const compliedComments = matchingComments.filter((c) => c.status === 'complied');
    const hasComments = matchingComments.length > 0;
    const isOpen = activeCellKey === cellKey;

    const Component = as;

    const baseClasses = `relative group transition-all ${hasComments ? 'cursor-pointer' : ''} ${className} ${
        pendingComments.length > 0
            ? 'bg-red-50/80 ring-2 ring-inset ring-red-600 rounded-sm print:bg-transparent print:ring-0 print:shadow-none print:outline-none'
            : (compliedComments.length > 0 ? 'bg-emerald-50/50 ring-1 ring-inset ring-emerald-400 rounded-sm print:bg-transparent print:ring-0 print:shadow-none print:outline-none' : '')
    }`;

    return (
        <Component
            ref={cellRef}
            onClick={(e) => {
                if (hasComments && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) {
                    setActiveCellKey(isOpen ? null : cellKey);
                }
            }}
            className={baseClasses}
        >
            {/* Google Sheets style corner triangle indicators & pill badges */}
            {pendingComments.length > 0 && (
                <>
                    <span
                        className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-l-[10px] border-t-red-600 border-l-transparent pointer-events-none z-10 no-print"
                        title={`${pendingComments.length} reviewer comment(s) pending compliance`}
                    />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveCellKey(isOpen ? null : cellKey);
                        }}
                        className="absolute -top-1.5 -right-1.5 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 hover:bg-red-700 text-white shadow-xs border-2 border-white cursor-pointer transition transform hover:scale-110 no-print"
                        title={`${pendingComments.length} reviewer comment(s) - Click to view/comply`}
                    >
                        💬 {pendingComments.length}
                    </button>
                </>
            )}

            {pendingComments.length === 0 && compliedComments.length > 0 && (
                <>
                    <span
                        className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-l-[8px] border-t-emerald-500 border-l-transparent pointer-events-none z-10 no-print"
                        title="All reviewer comments on this cell complied"
                    />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveCellKey(isOpen ? null : cellKey);
                        }}
                        className="absolute -top-1.5 -right-1.5 z-20 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-white cursor-pointer transition transform hover:scale-110 no-print"
                        title="Complied comment thread - Click to inspect"
                    >
                        ✓
                    </button>
                </>
            )}

            {/* Hover button for Reviewer to add comment if cell has no comments */}
            {!hasComments && canComment && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveCellKey(isOpen ? null : cellKey);
                    }}
                    className="absolute top-0.5 right-0.5 z-10 opacity-0 group-hover:opacity-100 p-0.5 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white rounded shadow-2xs border border-red-300 transition text-[10px] cursor-pointer no-print font-bold"
                    title="Add reviewer comment on this cell"
                >
                    💬+
                </button>
            )}

            {children}

            {/* Google Sheets Comment Card Popover */}
            {isOpen && (
                <CellCommentPopover
                    anchorEl={cellRef.current}
                    itemNo={itemNo}
                    fieldKey={fieldKey}
                    fieldLabel={fieldLabel}
                    cellValue={cellValue}
                    contextData={contextData}
                    comments={matchingComments}
                    changeLogs={changeLogs}
                    canComment={canComment}
                    canComply={canComply}
                    currentUser={currentUser}
                    onAddComment={(text) =>
                        onAddCellComment &&
                        onAddCellComment({
                            item_id: itemId || null,
                            item_no: itemNo || null,
                            field_key: fieldKey,
                            field_label: fieldLabel,
                            cell_value: String(cellValue || ''),
                            comment: text,
                        })
                    }
                    onDeleteComment={onDeleteCellComment}
                    onComplyComment={onComplyCellComment}
                    onUncomplyComment={onUncomplyCellComment}
                    onUpdateCellValue={onUpdateCellValue}
                    onClose={() => setActiveCellKey(null)}
                />
            )}
        </Component>
    );
};

export default CommentableCell;

