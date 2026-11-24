
import { authService, systemSettingService } from '../services/api';

let isDevMode = false;
let isGuardInitialized = false;
let isHandlingUnauthorized = false;

if (typeof window !== 'undefined' && window.App && typeof window.App.developer_mode !== 'undefined') {
    isDevMode = Boolean(window.App.developer_mode);
}

export const isDeveloperModeActive = () => isDevMode;

export const setDeveloperModeActive = (enabled) => {
    isDevMode = Boolean(enabled);
    if (typeof window !== 'undefined') {
        if (window.App) {
            window.App.developer_mode = isDevMode;
        }
        window.dispatchEvent(new CustomEvent('developer_mode:changed', {
            detail: { developer_mode: isDevMode }
        }));
    }
};

export const handleUnauthorizedDevToolsAccess = (actionName = 'inspect') => {
    if (isDevMode) return;
    if (isHandlingUnauthorized) return;

    isHandlingUnauthorized = true;

    const message = 'Unauthorized inspection detected. Developer Mode is currently DISABLED by the Super Administrator.';

    console.warn(`[SECURITY ALERT] ${actionName.toUpperCase()} is restricted when Developer Mode is disabled.`);

    window.dispatchEvent(new CustomEvent('devtools:unauthorized', {
        detail: { action: actionName, message }
    }));

    const currentUser = window.App?.user;
    if (currentUser) {
        authService.logout().catch(() => {}).finally(() => {
            if (window.App) {
                window.App.user = null;
            }
            window.dispatchEvent(new CustomEvent('auth:unauthorized', {
                detail: { reason: message }
            }));
        });
    }

    setTimeout(() => {
        isHandlingUnauthorized = false;
    }, 2000);
};

export const initDevToolsGuard = () => {
    if (isGuardInitialized || typeof window === 'undefined') return;
    isGuardInitialized = true;

    systemSettingService.getDeveloperMode()
        .then((res) => {
            if (res.data && typeof res.data.developer_mode !== 'undefined') {
                setDeveloperModeActive(res.data.developer_mode);
            }
        })
        .catch(() => {});

    window.addEventListener('developer_mode:changed', (e) => {
        if (e.detail && typeof e.detail.developer_mode !== 'undefined') {
            isDevMode = Boolean(e.detail.developer_mode);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (isDevMode) return;

        const isF12 = e.key === 'F12' || e.keyCode === 123;
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        const isAlt = e.altKey;

        const isInspectShortcut = (isCtrlOrCmd && isShift && (
            e.key === 'I' || e.key === 'i' || e.keyCode === 73 ||
            e.key === 'J' || e.key === 'j' || e.keyCode === 74 ||
            e.key === 'C' || e.key === 'c' || e.keyCode === 67 ||
            e.key === 'K' || e.key === 'k' || e.keyCode === 75
        )) || (isCtrlOrCmd && isAlt && (
            e.key === 'I' || e.key === 'i' || e.keyCode === 73 ||
            e.key === 'J' || e.key === 'j' || e.keyCode === 74 ||
            e.key === 'C' || e.key === 'c' || e.keyCode === 67
        ));

        const isViewSource = isCtrlOrCmd && (e.key === 'u' || e.key === 'U' || e.keyCode === 85);

        if (isF12 || isInspectShortcut || isViewSource) {
            e.preventDefault();
            e.stopPropagation();
            const action = isF12 ? 'F12 key' : (isViewSource ? 'View Source' : 'DevTools shortcut');
            handleUnauthorizedDevToolsAccess(action);
            return false;
        }
    }, true);

    window.addEventListener('contextmenu', (e) => {
        if (isDevMode) return;

        const target = e.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );

        if (isEditable) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
};

export default {
    initDevToolsGuard,
    isDeveloperModeActive,
    setDeveloperModeActive,
    handleUnauthorizedDevToolsAccess,
};
