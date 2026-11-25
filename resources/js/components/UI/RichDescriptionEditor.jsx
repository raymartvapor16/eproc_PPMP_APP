import React, { useRef, useEffect } from 'react';
import {
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    RemoveFormatting,
} from 'lucide-react';

const ALLOWED_TAGS = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'SPAN',
]);

const ALLOWED_ALIGN = new Set(['left', 'center', 'right', 'justify']);

export const isHtmlDescription = (val) => {
    if (!val || typeof val !== 'string') return false;
    return /<(b|strong|i|em|u|br|p|div|ul|ol|li|span)\b/i.test(val);
};

export const stripDescriptionHtml = (val) => {
    if (!val || typeof val !== 'string') return '';
    if (!isHtmlDescription(val)) return val;
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    try {
        const doc = new DOMParser().parseFromString(val, 'text/html');
        return (doc.body.textContent || '').trim();
    } catch (_) {
        return val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
};

const sanitizeNode = (node, doc) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return doc.createTextNode(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const tag = node.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') {
        return null;
    }

    if (!ALLOWED_TAGS.has(tag)) {
        const frag = doc.createDocumentFragment();
        node.childNodes.forEach((child) => {
            const cleanChild = sanitizeNode(child, doc);
            if (cleanChild) frag.appendChild(cleanChild);
        });
        return frag;
    }

    const el = doc.createElement(tag.toLowerCase());

    if (node.style) {
        const safeStyles = [];
        const align = (node.style.textAlign || '').toLowerCase().trim();
        if (align && ALLOWED_ALIGN.has(align)) {
            safeStyles.push(`text-align: ${align}`);
        }
        const fw = (node.style.fontWeight || '').toLowerCase().trim();
        if (fw === 'bold' || fw === '700' || fw === '800' || fw === '600') {
            safeStyles.push('font-weight: 700');
        }
        const fs = (node.style.fontStyle || '').toLowerCase().trim();
        if (fs === 'italic') {
            safeStyles.push('font-style: italic');
        }
        const td = (node.style.textDecoration || node.style.textDecorationLine || '').toLowerCase().trim();
        if (td.includes('underline')) {
            safeStyles.push('text-decoration: underline');
        }
        if (safeStyles.length > 0) {
            el.setAttribute('style', safeStyles.join('; '));
        }
    }

    node.childNodes.forEach((child) => {
        const cleanChild = sanitizeNode(child, doc);
        if (cleanChild) el.appendChild(cleanChild);
    });

    return el;
};

export const sanitizeDescriptionHtml = (html) => {
    if (!html || typeof html !== 'string') return '';
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return html;
    }
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const outDoc = document.implementation.createHTMLDocument('');
        const container = outDoc.createElement('div');
        doc.body.childNodes.forEach((child) => {
            const clean = sanitizeNode(child, outDoc);
            if (clean) container.appendChild(clean);
        });
        const result = container.innerHTML.trim();
        if (result === '<br>' || result === '<p><br></p>' || result === '<div><br></div>') {
            return '';
        }
        return result;
    } catch (_) {
        return html;
    }
};

const plainTextToHtml = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
};

export const RichDescriptionEditor = ({
    value = '',
    onChange,
    placeholder = 'Item specifications and description...',
    className = '',
}) => {
    const editorRef = useRef(null);
    const lastEmittedRef = useRef(value || '');

    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const incoming = value || '';
        if (incoming === lastEmittedRef.current && el.innerHTML !== '') {
            return;
        }
        const nextHtml = isHtmlDescription(incoming)
            ? sanitizeDescriptionHtml(incoming)
            : plainTextToHtml(incoming);
        if (el.innerHTML !== nextHtml) {
            el.innerHTML = nextHtml;
        }
        lastEmittedRef.current = incoming;
    }, [value]);

    const emitChange = () => {
        const el = editorRef.current;
        if (!el) return;
        const rawHtml = el.innerHTML;
        const plain = (el.textContent || '').trim();
        if (!plain && !/<(ul|ol|li)\b/i.test(rawHtml)) {
            lastEmittedRef.current = '';
            onChange?.('');
            return;
        }
        const cleanHtml = sanitizeDescriptionHtml(rawHtml);
        lastEmittedRef.current = cleanHtml;
        onChange?.(cleanHtml);
    };

    const exec = (cmd) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        try {
            document.execCommand(cmd, false, null);
        } catch (_) {}
        emitChange();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const html = e.clipboardData?.getData('text/html');
        const text = e.clipboardData?.getData('text/plain') || '';
        const toInsert = html ? sanitizeDescriptionHtml(html) : plainTextToHtml(text);
        try {
            document.execCommand('insertHTML', false, toInsert);
        } catch (_) {
            const el = editorRef.current;
            if (el) el.innerHTML += toInsert;
        }
        emitChange();
    };

    const toolbarBtnClass =
        'p-1 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition cursor-pointer flex items-center justify-center';

    return (
        <div className={`w-full border border-slate-300 rounded-md bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 ${className}`}>
            <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 bg-slate-50 border-b border-slate-200 rounded-t-md select-none">
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
                    className={toolbarBtnClass}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
                    className={toolbarBtnClass}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
                    className={toolbarBtnClass}
                    title="Underline (Ctrl+U)"
                >
                    <Underline className="w-3.5 h-3.5" />
                </button>

                <span className="w-px h-3.5 bg-slate-300 mx-1" />

                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}
                    className={toolbarBtnClass}
                    title="Bulleted List"
                >
                    <List className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}
                    className={toolbarBtnClass}
                    title="Numbered List"
                >
                    <ListOrdered className="w-3.5 h-3.5" />
                </button>

                <span className="w-px h-3.5 bg-slate-300 mx-1" />

                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }}
                    className={toolbarBtnClass}
                    title="Align Left"
                >
                    <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }}
                    className={toolbarBtnClass}
                    title="Align Center"
                >
                    <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }}
                    className={toolbarBtnClass}
                    title="Align Right"
                >
                    <AlignRight className="w-3.5 h-3.5" />
                </button>

                <span className="w-px h-3.5 bg-slate-300 mx-1" />

                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}
                    className={toolbarBtnClass}
                    title="Clear Formatting"
                >
                    <RemoveFormatting className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="relative">
                {!stripDescriptionHtml(value) && (
                    <div className="pointer-events-none absolute top-1.5 left-2 text-xs text-slate-400 select-none">
                        {placeholder}
                    </div>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={emitChange}
                    onBlur={emitChange}
                    onPaste={handlePaste}
                    className="min-h-[72px] h-[110px] resize-y overflow-y-auto px-2 py-1.5 text-xs leading-snug text-slate-900 whitespace-pre-wrap break-words outline-none rounded-b-md [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-0.5 [&_li]:my-0.5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline"
                />
            </div>
        </div>
    );
};

export const RichDescriptionDisplay = ({ value = '', className = '' }) => {
    if (!value) return null;

    if (isHtmlDescription(value)) {
        const cleanHtml = sanitizeDescriptionHtml(value);
        return (
            <div
                className={`whitespace-pre-wrap break-words leading-snug [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-0.5 [&_li]:my-0.5 [&_b]:font-extrabold [&_strong]:font-extrabold [&_i]:italic [&_em]:italic [&_u]:underline ${className}`}
                dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
        );
    }

    return (
        <div className={`whitespace-pre-wrap break-words leading-snug ${className}`}>
            {value}
        </div>
    );
};
