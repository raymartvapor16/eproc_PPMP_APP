import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';

const PDF_EXPORT_STYLE_ID = 'eproc-pdf-export-runtime-style';

function ensurePdfExportStyle() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(PDF_EXPORT_STYLE_ID);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = PDF_EXPORT_STYLE_ID;
    style.textContent = `
        html.pdf-exporting,
        html.pdf-exporting * {
            transition: none !important;
            transition-duration: 0s !important;
            animation: none !important;
        }
        html.pdf-exporting .no-print,
        html.pdf-exporting .no-print *,
        html.pdf-exporting .print\\:hidden {
            display: none !important;
        }
        html.pdf-exporting .pdf-export-spacer {
            display: block !important;
        }
        html.pdf-exporting .attachment-sheet {
            margin: 0 !important;
            padding: 16px !important;
            max-width: none !important;
            width: 820px !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
        }
        /* Strip all color outlines, rings, shadows, and highlight tints across PPMP, APP, and Detailed Specifications */
        html.pdf-exporting .attachment-sheet *,
        html.pdf-exporting .pdf-export-root *,
        html.pdf-exporting [data-commentable-cell="true"] {
            box-shadow: none !important;
            -webkit-box-shadow: none !important;
            outline: none !important;
            outline-width: 0 !important;
            outline-color: transparent !important;
            --tw-ring-shadow: 0 0 #0000 !important;
            --tw-inset-ring-shadow: 0 0 #0000 !important;
            --tw-shadow: 0 0 #0000 !important;
            --tw-inset-shadow: 0 0 #0000 !important;
        }
        html.pdf-exporting [data-commentable-cell="true"],
        html.pdf-exporting .attachment-sheet [class*="bg-emerald-"],
        html.pdf-exporting .attachment-sheet [class*="bg-green-"],
        html.pdf-exporting .attachment-sheet [class*="bg-red-"],
        html.pdf-exporting .attachment-sheet [class*="bg-rose-"],
        html.pdf-exporting .attachment-sheet [class*="bg-amber-"],
        html.pdf-exporting .pdf-export-root [class*="bg-emerald-"],
        html.pdf-exporting .pdf-export-root [class*="bg-green-"],
        html.pdf-exporting .pdf-export-root [class*="bg-red-"],
        html.pdf-exporting .pdf-export-root [class*="bg-rose-"],
        html.pdf-exporting .pdf-export-root [class*="bg-amber-"] {
            background-color: transparent !important;
            background: transparent !important;
        }
        html.pdf-exporting div[data-commentable-cell="true"],
        html.pdf-exporting span[data-commentable-cell="true"],
        html.pdf-exporting .attachment-sheet [class*="border-emerald-"],
        html.pdf-exporting .attachment-sheet [class*="border-green-"],
        html.pdf-exporting .attachment-sheet [class*="border-red-"],
        html.pdf-exporting .attachment-sheet [class*="border-rose-"],
        html.pdf-exporting .attachment-sheet [class*="border-amber-"],
        html.pdf-exporting .pdf-export-root [class*="border-emerald-"],
        html.pdf-exporting .pdf-export-root [class*="border-green-"],
        html.pdf-exporting .pdf-export-root [class*="border-red-"],
        html.pdf-exporting .pdf-export-root [class*="border-rose-"],
        html.pdf-exporting .pdf-export-root [class*="border-amber-"] {
            border-color: transparent !important;
        }
        html.pdf-exporting td[data-commentable-cell="true"],
        html.pdf-exporting th[data-commentable-cell="true"],
        html.pdf-exporting .attachment-sheet table [class*="border-emerald-"],
        html.pdf-exporting .attachment-sheet table [class*="border-green-"],
        html.pdf-exporting .attachment-sheet table [class*="border-red-"],
        html.pdf-exporting .attachment-sheet table [class*="border-amber-"],
        html.pdf-exporting .pdf-export-root table [class*="border-emerald-"],
        html.pdf-exporting .pdf-export-root table [class*="border-green-"],
        html.pdf-exporting .pdf-export-root table [class*="border-red-"],
        html.pdf-exporting .pdf-export-root table [class*="border-amber-"] {
            border-color: #000000 !important;
        }
        html.pdf-exporting .attachment-sheet button,
        html.pdf-exporting .pdf-export-root button {
            display: none !important;
        }
        html.pdf-exporting .attachment-sheet table td,
        html.pdf-exporting .attachment-sheet table th,
        html.pdf-exporting .pdf-export-root table td,
        html.pdf-exporting .pdf-export-root table th {
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            min-width: 0 !important;
        }
        html.pdf-exporting .pdf-export-root label,
        html.pdf-exporting .pdf-export-root .whitespace-nowrap,
        html.pdf-exporting .attachment-sheet label,
        html.pdf-exporting .attachment-sheet .whitespace-nowrap {
            white-space: nowrap !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
            flex-shrink: 0 !important;
        }
    `;
    document.head.appendChild(style);
}

function waitForRenderFrames() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function sanitizePdfFilename(name, fallback = 'document') {
    const cleaned = String(name || fallback)
        .replace(/[^a-zA-Z0-9_\-\s]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    const base = cleaned || fallback;
    return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function collectLayoutBreakHints(target, captureHeight, imgHeightPx, pageSliceHeightPx) {
    const avoidRanges = [];
    const tables = [];

    if (!target || !captureHeight || !imgHeightPx) {
        return { avoidRanges, tables };
    }

    const targetRect = target.getBoundingClientRect();
    const scaleY = imgHeightPx / captureHeight;

    const toRange = (el) => {
        if (!el || typeof el.getBoundingClientRect !== 'function') return null;
        if (el.closest?.('.no-print, .print\\:hidden')) return null;
        const rect = el.getBoundingClientRect();
        if (rect.height <= 0.5 || rect.width <= 0.5) return null;
        const top = Math.max(0, Math.floor((rect.top - targetRect.top) * scaleY));
        const bottom = Math.min(imgHeightPx, Math.ceil((rect.bottom - targetRect.top) * scaleY));
        if (bottom <= top) return null;
        return { top, bottom, height: bottom - top };
    };

    const addRange = (top, bottom, maxFraction = 0.85) => {
        const h = bottom - top;
        if (h > 0 && h <= pageSliceHeightPx * maxFraction) {
            avoidRanges.push({ top, bottom });
        }
    };

    target.querySelectorAll('tr').forEach((tr) => {
        const r = toRange(tr);
        if (r) addRange(r.top, r.bottom, 0.92);
    });

    target.querySelectorAll('table').forEach((table) => {
        const tableRect = toRange(table);
        if (!tableRect) return;

        if (tableRect.height <= pageSliceHeightPx * 0.45) {
            addRange(tableRect.top, tableRect.bottom, 0.5);
        }

        const thead = table.querySelector(':scope > thead');
        const tbody = table.querySelector(':scope > tbody');
        const theadRect = thead ? toRange(thead) : null;
        const tbodyRect = tbody ? toRange(tbody) : null;

        if (theadRect) {
            addRange(theadRect.top, theadRect.bottom, 0.5);
            const firstBodyRow = tbody?.querySelector(':scope > tr');
            const firstRowRect = firstBodyRow ? toRange(firstBodyRow) : null;
            if (firstRowRect) {
                addRange(theadRect.top, firstRowRect.bottom, 0.65);
            }
            if (tbodyRect && theadRect.height < pageSliceHeightPx * 0.28) {
                tables.push({
                    theadTop: theadRect.top,
                    theadBottom: theadRect.bottom,
                    tbodyTop: tbodyRect.top,
                    tbodyBottom: tbodyRect.bottom,
                });
            }
        }
    });

    target.querySelectorAll('.print-signature-box, .pdf-avoid-break, [data-pdf-avoid-break="true"]').forEach((el) => {
        const r = toRange(el);
        if (r) addRange(r.top, r.bottom, 0.85);
    });

    target.querySelectorAll('.pdf-keep-with-next, [data-pdf-keep-with-next="true"]').forEach((headerEl) => {
        const hRect = toRange(headerEl);
        if (!hRect) return;
        addRange(hRect.top, hRect.bottom, 0.5);

        const nextEl = headerEl.nextElementSibling;
        if (nextEl) {
            if (nextEl.tagName === 'TABLE') {
                const thead = nextEl.querySelector(':scope > thead');
                const firstRow = nextEl.querySelector(':scope > tbody > tr') || nextEl.querySelector(':scope > tr');
                const anchorEl = firstRow || thead || nextEl;
                const aRect = toRange(anchorEl);
                if (aRect) {
                    addRange(hRect.top, aRect.bottom, 0.72);
                }
            } else {
                const nRect = toRange(nextEl);
                if (nRect) {
                    addRange(hRect.top, nRect.bottom, 0.65);
                }
            }
        }
    });

    target.querySelectorAll('img').forEach((img) => {
        const r = toRange(img);
        if (r) addRange(r.top, r.bottom, 0.6);
    });

    target.querySelectorAll('p, h1, h2, h3, h4, li').forEach((el) => {
        if (el.closest('td, th')) return;
        const r = toRange(el);
        if (r) addRange(r.top, r.bottom, 0.35);
    });

    return { avoidRanges, tables };
}

function findCleanestScanline(canvas, minCutY, idealCut) {
    const searchTop = Math.max(minCutY, idealCut - Math.floor((idealCut - minCutY) * 0.25));
    const searchHeight = idealCut - searchTop;
    if (searchHeight <= 4) return idealCut;

    try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const w = canvas.width;
        const data = ctx.getImageData(0, searchTop, w, searchHeight).data;
        let bestY = idealCut;
        let minDark = Infinity;

        for (let row = searchHeight - 1; row >= 0; row -= 2) {
            let darkCount = 0;
            const rowOffset = row * w * 4;
            for (let x = 0; x < w; x += 4) {
                const idx = rowOffset + x * 4;
                if (data[idx] < 210 || data[idx + 1] < 210 || data[idx + 2] < 210) {
                    darkCount++;
                }
            }
            if (darkCount < minDark) {
                minDark = darkCount;
                bestY = searchTop + row;
                if (darkCount === 0) break;
            }
        }
        return bestY;
    } catch {
        return idealCut;
    }
}

function findSafeCutY(yStart, maxContentH, imgHeightPx, avoidRanges, canvas) {
    const idealCut = yStart + maxContentH;
    if (idealCut >= imgHeightPx) {
        return imgHeightPx;
    }

    const minCutY = yStart + Math.max(40, Math.floor(maxContentH * 0.22));
    let cutY = idealCut;

    for (let iter = 0; iter < 30; iter++) {
        let earliestTop = cutY;
        for (const r of avoidRanges) {

            if (r.top < cutY - 1 && r.bottom > cutY + 1) {
                if (r.top >= minCutY && r.top < earliestTop) {
                    earliestTop = r.top;
                }
            }
        }
        if (earliestTop < cutY) {
            cutY = earliestTop;
        } else {
            break;
        }
    }

    const stillStraddling = avoidRanges.some((r) => r.top < cutY - 1 && r.bottom > cutY + 1);
    if (stillStraddling) {
        cutY = findCleanestScanline(canvas, minCutY, cutY);
    }

    return Math.max(Math.min(imgHeightPx, yStart + 40), Math.min(imgHeightPx, cutY));
}

export async function exportElementsToPdf({
    element = null,
    elements = null,
    filename = 'document.pdf',
    orientation = 'landscape',
    format = 'a4',
    marginMm = 8,
}) {
    const targets = Array.isArray(elements) && elements.length > 0
        ? elements.filter(Boolean)
        : (element ? [element] : []);

    if (targets.length === 0) {
        throw new Error('No printable content found to export.');
    }

    ensurePdfExportStyle();
    document.documentElement.classList.add('pdf-exporting');

    const restoredStyles = [];
    for (const target of targets) {
        const commentCells = target.querySelectorAll('[data-commentable-cell="true"]');
        commentCells.forEach((cell) => {
            restoredStyles.push({
                el: cell,
                prevStyle: cell.getAttribute('style'),
            });
            cell.style.setProperty('transition', 'none', 'important');
            cell.style.setProperty('box-shadow', 'none', 'important');
            cell.style.setProperty('-webkit-box-shadow', 'none', 'important');
            cell.style.setProperty('outline', 'none', 'important');
            cell.style.setProperty('background-color', 'transparent', 'important');
            cell.style.setProperty('background', 'transparent', 'important');
            const tag = cell.tagName.toUpperCase();
            if (tag === 'TD' || tag === 'TH') {
                cell.style.setProperty('border-color', '#000000', 'important');
            } else {
                cell.style.setProperty('border-color', 'transparent', 'important');
            }
        });
    }

    try {
        await waitForRenderFrames();

        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format,
            compress: true,
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const usableWidth = pageWidth - marginMm * 2;
        const usableHeight = pageHeight - marginMm * 2;

        let isFirstPage = true;

        for (const target of targets) {
            const captureWidth = Math.ceil(Math.max(target.scrollWidth, target.offsetWidth));
            const captureHeight = Math.ceil(Math.max(target.scrollHeight, target.offsetHeight));

            const canvas = await toCanvas(target, {
                width: captureWidth,
                height: captureHeight,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: true,
                cacheBust: false,
                style: {
                    margin: '0',
                    marginLeft: '0',
                    marginRight: '0',
                    marginTop: '0',
                    marginBottom: '0',
                    transform: 'none',
                    maxWidth: 'none',
                    width: `${captureWidth}px`,
                    boxSizing: 'border-box',
                },
                filter: (node) => {
                    if (node?.classList) {
                        if (node.classList.contains('no-print') || node.classList.contains('print:hidden')) {
                            return false;
                        }
                    }
                    return true;
                },
            });

            const imgWidthPx = canvas.width;
            const imgHeightPx = canvas.height;

            if (!imgWidthPx || !imgHeightPx) continue;

            const scaledHeightAtFullWidth = (imgHeightPx * usableWidth) / imgWidthPx;

            if (scaledHeightAtFullWidth <= usableHeight * 1.15) {
                const scale = Math.min(usableWidth / imgWidthPx, usableHeight / imgHeightPx);
                const renderW = imgWidthPx * scale;
                const renderH = imgHeightPx * scale;
                const offsetX = marginMm + (usableWidth - renderW) / 2;

                if (!isFirstPage) {
                    pdf.addPage(format, orientation);
                }
                isFirstPage = false;

                const jpegData = canvas.toDataURL('image/jpeg', 0.94);
                pdf.addImage(jpegData, 'JPEG', offsetX, marginMm, renderW, renderH, undefined, 'FAST');
            } else {

                const pageSliceHeightPx = Math.floor((usableHeight * imgWidthPx) / usableWidth);
                const { avoidRanges, tables } = collectLayoutBreakHints(
                    target,
                    captureHeight,
                    imgHeightPx,
                    pageSliceHeightPx
                );

                let yOffsetPx = 0;
                let guard = 0;

                while (yOffsetPx < imgHeightPx && guard < 100) {
                    guard++;

                    const activeTable = yOffsetPx > 0
                        ? tables.find((t) => yOffsetPx >= t.tbodyTop && yOffsetPx < t.tbodyBottom - 4)
                        : null;

                    const repeatHeaderH = activeTable ? (activeTable.theadBottom - activeTable.theadTop) : 0;
                    const bodyBudgetPx = Math.max(120, pageSliceHeightPx - repeatHeaderH);

                    const cutY = findSafeCutY(yOffsetPx, bodyBudgetPx, imgHeightPx, avoidRanges, canvas);
                    const bodySliceH = cutY - yOffsetPx;
                    if (bodySliceH <= 0) break;

                    const endsMidTable = tables.some((t) => cutY > t.tbodyTop && cutY < t.tbodyBottom - 2);
                    const extraBorderPx = endsMidTable ? Math.min(2, imgHeightPx - cutY) : 0;
                    const totalSliceH = repeatHeaderH + bodySliceH + extraBorderPx;

                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = imgWidthPx;
                    sliceCanvas.height = totalSliceH;
                    const ctx = sliceCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

                    if (activeTable && repeatHeaderH > 0) {
                        ctx.drawImage(
                            canvas,
                            0, activeTable.theadTop, imgWidthPx, repeatHeaderH,
                            0, 0, imgWidthPx, repeatHeaderH
                        );
                    }

                    ctx.drawImage(
                        canvas,
                        0, yOffsetPx, imgWidthPx, bodySliceH + extraBorderPx,
                        0, repeatHeaderH, imgWidthPx, bodySliceH + extraBorderPx
                    );

                    const sliceJpeg = sliceCanvas.toDataURL('image/jpeg', 0.94);
                    const sliceRenderH = (totalSliceH * usableWidth) / imgWidthPx;

                    if (!isFirstPage) {
                        pdf.addPage(format, orientation);
                    }
                    isFirstPage = false;
                    pdf.addImage(sliceJpeg, 'JPEG', marginMm, marginMm, usableWidth, sliceRenderH, undefined, 'FAST');

                    yOffsetPx = cutY;
                }
            }
        }

        const pdfBlob = pdf.output('blob');
        triggerBlobDownload(pdfBlob, sanitizePdfFilename(filename));
    } finally {
        for (const { el, prevStyle } of restoredStyles) {
            if (prevStyle === null) {
                el.removeAttribute('style');
            } else {
                el.setAttribute('style', prevStyle);
            }
        }
        document.documentElement.classList.remove('pdf-exporting');
    }
}

export function createBulkPdfSession({
    orientation = 'landscape',
    format = 'legal',
    marginMm = 6,
} = {}) {
    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
        compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - marginMm * 2;
    const usableHeight = pageHeight - marginMm * 2;
    let isFirstPage = true;
    let pageCount = 0;

    ensurePdfExportStyle();

    return {
        async appendElement(target) {
            if (!target) return;
            document.documentElement.classList.add('pdf-exporting');

            const restoredStyles = [];
            const commentCells = target.querySelectorAll('[data-commentable-cell="true"]');
            commentCells.forEach((cell) => {
                restoredStyles.push({ el: cell, prevStyle: cell.getAttribute('style') });
                cell.style.setProperty('transition', 'none', 'important');
                cell.style.setProperty('box-shadow', 'none', 'important');
                cell.style.setProperty('-webkit-box-shadow', 'none', 'important');
                cell.style.setProperty('outline', 'none', 'important');
                cell.style.setProperty('background-color', 'transparent', 'important');
                cell.style.setProperty('background', 'transparent', 'important');
                const tag = cell.tagName.toUpperCase();
                cell.style.setProperty('border-color', (tag === 'TD' || tag === 'TH') ? '#000000' : 'transparent', 'important');
            });

            try {
                await waitForRenderFrames();

                const captureWidth = Math.ceil(Math.max(target.scrollWidth, target.offsetWidth));
                const captureHeight = Math.ceil(Math.max(target.scrollHeight, target.offsetHeight));
                if (!captureWidth || !captureHeight) return;

                const canvas = await toCanvas(target, {
                    width: captureWidth,
                    height: captureHeight,
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                    skipFonts: true,
                    cacheBust: false,
                    style: {
                        margin: '0',
                        marginLeft: '0',
                        marginRight: '0',
                        marginTop: '0',
                        marginBottom: '0',
                        transform: 'none',
                        maxWidth: 'none',
                        width: `${captureWidth}px`,
                        boxSizing: 'border-box',
                    },
                    filter: (node) => {
                        if (node?.classList) {
                            if (node.classList.contains('no-print') || node.classList.contains('print:hidden')) {
                                return false;
                            }
                        }
                        return true;
                    },
                });

                const imgWidthPx = canvas.width;
                const imgHeightPx = canvas.height;
                if (!imgWidthPx || !imgHeightPx) return;

                const scaledHeightAtFullWidth = (imgHeightPx * usableWidth) / imgWidthPx;

                if (scaledHeightAtFullWidth <= usableHeight * 1.15) {
                    const scale = Math.min(usableWidth / imgWidthPx, usableHeight / imgHeightPx);
                    const renderW = imgWidthPx * scale;
                    const renderH = imgHeightPx * scale;
                    const offsetX = marginMm + (usableWidth - renderW) / 2;

                    if (!isFirstPage) pdf.addPage(format, orientation);
                    isFirstPage = false;
                    pageCount++;

                    const jpegData = canvas.toDataURL('image/jpeg', 0.92);
                    pdf.addImage(jpegData, 'JPEG', offsetX, marginMm, renderW, renderH, undefined, 'FAST');
                } else {
                    const pageSliceHeightPx = Math.floor((usableHeight * imgWidthPx) / usableWidth);
                    const { avoidRanges, tables } = collectLayoutBreakHints(
                        target,
                        captureHeight,
                        imgHeightPx,
                        pageSliceHeightPx
                    );

                    let yOffsetPx = 0;
                    let guard = 0;

                    while (yOffsetPx < imgHeightPx && guard < 100) {
                        guard++;
                        const activeTable = yOffsetPx > 0
                            ? tables.find((t) => yOffsetPx >= t.tbodyTop && yOffsetPx < t.tbodyBottom - 4)
                            : null;
                        const repeatHeaderH = activeTable ? (activeTable.theadBottom - activeTable.theadTop) : 0;
                        const bodyBudgetPx = Math.max(120, pageSliceHeightPx - repeatHeaderH);

                        const cutY = findSafeCutY(yOffsetPx, bodyBudgetPx, imgHeightPx, avoidRanges, canvas);
                        const bodySliceH = cutY - yOffsetPx;
                        if (bodySliceH <= 0) break;

                        const endsMidTable = tables.some((t) => cutY > t.tbodyTop && cutY < t.tbodyBottom - 2);
                        const extraBorderPx = endsMidTable ? Math.min(2, imgHeightPx - cutY) : 0;
                        const totalSliceH = repeatHeaderH + bodySliceH + extraBorderPx;

                        const sliceCanvas = document.createElement('canvas');
                        sliceCanvas.width = imgWidthPx;
                        sliceCanvas.height = totalSliceH;
                        const ctx = sliceCanvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

                        if (activeTable && repeatHeaderH > 0) {
                            ctx.drawImage(
                                canvas,
                                0, activeTable.theadTop, imgWidthPx, repeatHeaderH,
                                0, 0, imgWidthPx, repeatHeaderH
                            );
                        }
                        ctx.drawImage(
                            canvas,
                            0, yOffsetPx, imgWidthPx, bodySliceH + extraBorderPx,
                            0, repeatHeaderH, imgWidthPx, bodySliceH + extraBorderPx
                        );

                        const sliceJpeg = sliceCanvas.toDataURL('image/jpeg', 0.92);
                        const sliceRenderH = (totalSliceH * usableWidth) / imgWidthPx;

                        if (!isFirstPage) pdf.addPage(format, orientation);
                        isFirstPage = false;
                        pageCount++;
                        pdf.addImage(sliceJpeg, 'JPEG', marginMm, marginMm, usableWidth, sliceRenderH, undefined, 'FAST');

                        yOffsetPx = cutY;
                    }
                }
            } finally {
                for (const { el, prevStyle } of restoredStyles) {
                    if (prevStyle === null) el.removeAttribute('style');
                    else el.setAttribute('style', prevStyle);
                }
                document.documentElement.classList.remove('pdf-exporting');
            }
        },
        getPageCount() {
            return pageCount;
        },
        save(filename = 'Bulk_PPMP_APP_Merged.pdf') {
            const pdfBlob = pdf.output('blob');
            triggerBlobDownload(pdfBlob, sanitizePdfFilename(filename));
        },
    };
}

export async function printBulkHtmlDocuments(htmlSections = [], {
    orientation = 'landscape',
    pageSize = 'legal',
    title = 'Bulk Print — PPMP & APP',
} = {}) {
    if (!Array.isArray(htmlSections) || htmlSections.length === 0) return;

    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
${headStyles}
<style>
    @page { size: ${pageSize} ${orientation}; margin: 6mm; }
    html, body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; color: #000000 !important; }
    .bulk-print-doc { page-break-after: always; break-after: page; width: 100%; background: #ffffff; }
    .bulk-print-doc:last-child { page-break-after: auto; break-after: auto; }
    .no-print, .print\\:hidden, button { display: none !important; }
    .pdf-export-spacer { display: block !important; }
    .pdf-export-root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 4px !important; box-shadow: none !important; border: none !important; }
    .pdf-export-root table td, .pdf-export-root table th { overflow-wrap: anywhere !important; word-break: break-word !important; }
    .print-signature-box, .pdf-avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
</style>
</head>
<body>
${htmlSections.map((html) => `<div class="bulk-print-doc">${html}</div>`).join('\n')}
</body>
</html>`);
    doc.close();

    await new Promise((resolve) => {
        const imgs = Array.from(doc.images || []);
        if (imgs.length === 0) return setTimeout(resolve, 200);
        let remaining = imgs.length;
        const done = () => {
            remaining--;
            if (remaining <= 0) setTimeout(resolve, 150);
        };
        const safety = setTimeout(resolve, 3000);
        imgs.forEach((img) => {
            if (img.complete) done();
            else {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
        if (remaining <= 0) {
            clearTimeout(safety);
            setTimeout(resolve, 150);
        }
    });

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 60000);
}
