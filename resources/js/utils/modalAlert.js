
const ALERT_EVENT_NAME = 'app:show_modal_alert';

export function parseAlertMessage(raw) {
    if (!raw && raw !== 0) {
        return {
            title: 'System Notification',
            introText: '',
            bulletItems: [],
            outroText: '',
            type: 'info',
        };
    }

    if (typeof raw === 'object' && raw !== null) {
        return {
            title: raw.title || 'System Notification',
            introText: raw.message || raw.introText || '',
            bulletItems: Array.isArray(raw.bullets || raw.bulletItems) ? (raw.bullets || raw.bulletItems) : [],
            outroText: raw.outroText || raw.footer || '',
            type: raw.type || 'info',
            confirmText: raw.confirmText || 'OK',
            cancelText: raw.cancelText || 'Cancel',
            onConfirm: raw.onConfirm,
            onCancel: raw.onCancel,
        };
    }

    const str = String(raw).trim();
    const lower = str.toLowerCase();

    let type = 'info';
    if (
        lower.includes('failed') ||
        lower.includes('error') ||
        lower.includes('disapproved') ||
        lower.includes('invalid') ||
        lower.includes('cannot delete') ||
        lower.includes('prohibited')
    ) {
        type = 'error';
    } else if (
        lower.includes('incomplete') ||
        lower.includes('warning') ||
        lower.includes('cannot submit') ||
        lower.includes('exceed') ||
        lower.includes('required') ||
        lower.includes('missing') ||
        lower.includes('unfilled') ||
        lower.includes('compliance') ||
        lower.includes('attention') ||
        lower.includes('mandatory')
    ) {
        type = 'warning';
    } else if (
        lower.includes('success') ||
        lower.includes('approved') ||
        lower.includes('resubmitted')
    ) {
        type = 'success';
    }

    const lines = str.split(/\r?\n/);
    let title = '';
    let startIdx = 0;

    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (
            (firstLine.endsWith(':') && firstLine.length < 90) ||
            (lines.length > 1 && lines[1].trim() === '' && firstLine.length < 70)
        ) {
            title = firstLine.replace(/:\s*$/, '').trim();
            startIdx = 1;

            while (startIdx < lines.length && lines[startIdx].trim() === '') {
                startIdx++;
            }
        }
    }

    if (!title) {
        if (type === 'warning') title = 'Action Required';
        else if (type === 'error') title = 'Notice & Error';
        else if (type === 'success') title = 'Action Successful';
        else title = 'System Notification';
    }

    const remainingLines = lines.slice(startIdx);
    const bulletItems = [];
    const introParagraphs = [];
    const outroParagraphs = [];
    let state = 'intro';

    for (let i = 0; i < remainingLines.length; i++) {
        const line = remainingLines[i].trim();
        const isBullet = /^([•\-\*]|\d+\.)\s+(.+)$/.test(line);

        if (isBullet) {
            state = 'bullets';
            const bulletMatch = line.match(/^([•\-\*]|\d+\.)\s+(.+)$/);
            bulletItems.push(bulletMatch ? bulletMatch[2].trim() : line);
        } else if (line === '') {
            if (state === 'bullets' && i + 1 < remainingLines.length && !/^([•\-\*]|\d+\.)\s+/.test(remainingLines[i + 1].trim())) {
                state = 'outro';
            }
        } else {
            if (state === 'bullets') {
                state = 'outro';
            }
            if (state === 'intro') {
                introParagraphs.push(line);
            } else {
                outroParagraphs.push(line);
            }
        }
    }

    return {
        title,
        introText: introParagraphs.join('\n\n'),
        bulletItems,
        outroText: outroParagraphs.join('\n\n'),
        type,
        confirmText: 'OK',
    };
}

export function showAlert(optionsOrMessage) {
    return new Promise((resolve) => {
        const parsed = parseAlertMessage(optionsOrMessage);

        const payload = {
            ...parsed,
            isConfirm: false,
            onClose: () => {
                if (typeof parsed.onConfirm === 'function') {
                    try {
                        parsed.onConfirm();
                    } catch (e) {
                        console.error('Error in onConfirm handler:', e);
                    }
                }
                resolve();
            },
        };

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(ALERT_EVENT_NAME, {
                    detail: payload,
                })
            );
        } else {
            resolve();
        }
    });
}

export function showConfirm(optionsOrMessage) {
    return new Promise((resolve) => {
        let options = {};

        if (typeof optionsOrMessage === 'string') {
            const rawStr = optionsOrMessage.trim();
            const lower = rawStr.toLowerCase();

            let type = 'info';
            let title = 'Please Confirm';
            let confirmText = 'Confirm';

            if (lower.includes('approve') || lower.includes('certif') || lower.includes('finalize')) {
                type = 'success';
                title = 'Confirm Approval & Routing';
                confirmText = 'Yes, Approve PPMP';
            } else if (lower.includes('delete') || lower.includes('remove') || lower.includes('recycle')) {
                type = 'danger';
                title = 'Confirm Permanent Deletion';
                confirmText = 'Yes, Delete';
            } else if (lower.includes('submit') || lower.includes('resubmit')) {
                type = 'info';
                title = 'Confirm Submission';
                confirmText = 'Yes, Submit';
            } else if (lower.includes('unmark')) {
                type = 'warning';
                title = 'Confirm Unmark';
                confirmText = 'Yes, Unmark';
            } else {
                type = 'warning';
                title = 'Action Confirmation';
                confirmText = 'Confirm';
            }

            const parsed = parseAlertMessage(rawStr);
            options = {
                ...parsed,
                title: parsed.title && parsed.title !== 'System Notification' && parsed.title !== 'Action Required'
                    ? parsed.title
                    : title,
                type: parsed.type !== 'info' ? parsed.type : type,
                confirmText,
                cancelText: 'Cancel',
            };
        } else if (typeof optionsOrMessage === 'object' && optionsOrMessage !== null) {
            const parsed = parseAlertMessage(optionsOrMessage);
            options = {
                ...parsed,
                title: optionsOrMessage.title || parsed.title || 'Please Confirm',
                type: optionsOrMessage.type || (optionsOrMessage.isDestructive ? 'danger' : parsed.type) || 'info',
                confirmText: optionsOrMessage.confirmText || 'Confirm',
                cancelText: optionsOrMessage.cancelText || 'Cancel',
            };
        }

        const payload = {
            ...options,
            isConfirm: true,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
            onClose: () => resolve(false),
        };

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(ALERT_EVENT_NAME, {
                    detail: payload,
                })
            );
        } else {
            resolve(false);
        }
    });
}

export function initGlobalAlertModal() {
    if (typeof window === 'undefined') return;

    if (!window.__nativeAlert) {
        window.__nativeAlert = window.alert;
    }

    window.alert = function (message) {
        showAlert(message);
    };

    window.showModalAlert = showAlert;
    window.showConfirm = showConfirm;
    window.appConfirm = showConfirm;
}
