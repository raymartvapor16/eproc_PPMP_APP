/**
 * DevTools & Developer Mode Security Guard
 * 
 * Protects application from unauthorized inspection (F12, DevTools shortcuts)
 * when Developer Mode is disabled by the Super Administrator.
 * When Developer Mode is ENABLED by Super Admin, all inspection and DevTools access is permitted.
 */

import { authService, systemSettingService } from '../services/api';

let isDevMode = false;
let isGuardInitialized = false;
let isHandlingUnauthorized = false;

// Initialize state from window.App or default false
if (typeof window !== 'undefined' && window.App && typeof window.App.developer_mode !== 'undefined') {
    isDevMode = Boolean(window.App.developer_mode);
}

/**
 * Check if Developer Mode is currently enabled
 */
export const isDeveloperModeActive = () => isDevMode;

/**
 * Update Developer Mode state in memory and notify listeners
 */
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

/**
 * Trigger unauthorized inspection action:
 * When Developer Mode is disabled and an explicit developer inspection action
 * (e.g., F12 or DevTools keyboard shortcut) is executed.
 */
export const handleUnauthorizedDevToolsAccess = (actionName = 'inspect') => {
    if (isDevMode) return;
    if (isHandlingUnauthorized) return;

    isHandlingUnauthorized = true;

    const message = 'Unauthorized inspection detected. Developer Mode is currently DISABLED by the Super Administrator.';

    // Log to console warning
    console.warn(`[SECURITY ALERT] ${actionName.toUpperCase()} is restricted when Developer Mode is disabled.`);

    // Dispatch custom event for UI banners/alerts
    window.dispatchEvent(new CustomEvent('devtools:unauthorized', {
        detail: { action: actionName, message }
    }));

    // If user session exists, perform instant logout and trigger auth:unauthorized
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

/**
 * Setup DevTools Guard Listeners
 */
export const initDevToolsGuard = () => {
    if (isGuardInitialized || typeof window === 'undefined') return;
    isGuardInitialized = true;

    // 1. Sync latest developer mode setting from server
    systemSettingService.getDeveloperMode()
        .then((res) => {
            if (res.data && typeof res.data.developer_mode !== 'undefined') {
                setDeveloperModeActive(res.data.developer_mode);
            }
        })
        .catch(() => {});

    // Listen to real-time changes
    window.addEventListener('developer_mode:changed', (e) => {
        if (e.detail && typeof e.detail.developer_mode !== 'undefined') {
            isDevMode = Boolean(e.detail.developer_mode);
        }
    });

    // 2. Keyboard shortcut guard (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Mac Cmd+Opt+...)
    window.addEventListener('keydown', (e) => {
        if (isDevMode) return; // Unrestricted when developer mode is ON

        const isF12 = e.key === 'F12' || e.keyCode === 123;
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        const isAlt = e.altKey;

        // Windows/Linux: Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K
        // Mac: Cmd+Option+I, Cmd+Option+J, Cmd+Option+C
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

        // Ctrl+U (View Source)
        const isViewSource = isCtrlOrCmd && (e.key === 'u' || e.key === 'U' || e.keyCode === 85);

        if (isF12 || isInspectShortcut || isViewSource) {
            e.preventDefault();
            e.stopPropagation();
            const action = isF12 ? 'F12 key' : (isViewSource ? 'View Source' : 'DevTools shortcut');
            handleUnauthorizedDevToolsAccess(action);
            return false;
        }
    }, true);

    // 3. Right-Click Context Menu Guard:
    // Prevent right-click context menu (which contains "Inspect") on non-editable elements,
    // while allowing users to right-click in text fields to copy/paste, and without false-flagging.
    window.addEventListener('contextmenu', (e) => {
        if (isDevMode) return; // Allowed when developer mode is ON

        const target = e.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );

        if (isEditable) {
            return; // Allow native right click on input fields
        }

        // Prevent opening browser context menu (disables Inspect option)
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
