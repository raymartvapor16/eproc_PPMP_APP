import { useState, useEffect } from 'react';
import { systemSettingService } from '../services/api';

const STORAGE_KEY = 'eproc_signature_settings';

const DEFAULT_SETTINGS = {
    pnpki_enabled: typeof window !== 'undefined' && window.App?.pnpki_enabled !== undefined ? Boolean(window.App.pnpki_enabled) : true,
    ppmp: true,
    app: true,
    attachment_list: true,
};

let cachedSettings = null;

function initCache() {
    if (cachedSettings !== null) return cachedSettings;
    const winSettings = typeof window !== 'undefined' ? window.App?.signature_settings : null;
    const winPnpki = typeof window !== 'undefined' && window.App?.pnpki_enabled !== undefined
        ? Boolean(window.App.pnpki_enabled)
        : undefined;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            cachedSettings = {
                pnpki_enabled: winPnpki !== undefined
                    ? winPnpki
                    : (parsed.pnpki_enabled !== undefined ? parsed.pnpki_enabled !== false : true),
                ppmp: winSettings?.ppmp !== undefined ? winSettings.ppmp !== false : parsed.ppmp !== false,
                app: winSettings?.app !== undefined ? winSettings.app !== false : parsed.app !== false,
                attachment_list: winSettings?.attachment_list !== undefined ? winSettings.attachment_list !== false : parsed.attachment_list !== false,
            };
            return cachedSettings;
        }
    } catch (e) {

    }
    cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...(winSettings ? {
            pnpki_enabled: winSettings.pnpki_enabled !== false,
            ppmp: winSettings.ppmp !== false,
            app: winSettings.app !== false,
            attachment_list: winSettings.attachment_list !== false,
        } : {}),
    };
    return cachedSettings;
}

export function getSignatureSettings() {
    return initCache();
}

export function isPnpkiEnabled() {
    return getSignatureSettings().pnpki_enabled !== false;
}

export function setLocalSignatureSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    const current = initCache();
    cachedSettings = {
        pnpki_enabled: settings.pnpki_enabled !== undefined ? settings.pnpki_enabled !== false : current.pnpki_enabled !== false,
        ppmp: settings.ppmp !== undefined ? settings.ppmp !== false : current.ppmp !== false,
        app: settings.app !== undefined ? settings.app !== false : current.app !== false,
        attachment_list: settings.attachment_list !== undefined ? settings.attachment_list !== false : current.attachment_list !== false,
    };
    if (typeof window !== 'undefined' && window.App) {
        window.App.pnpki_enabled = cachedSettings.pnpki_enabled;
        window.App.signature_settings = { ...cachedSettings };
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
    } catch (e) {

    }
    window.dispatchEvent(new CustomEvent('signature_settings:changed', { detail: cachedSettings }));
}

export async function fetchSignatureSettings() {
    try {
        const response = await systemSettingService.getSignatureSettings();
        if (response?.data?.settings) {
            setLocalSignatureSettings(response.data.settings);
            return response.data.settings;
        }
    } catch (error) {
        console.warn('Failed to fetch signature settings:', error);
    }
    return getSignatureSettings();
}

export function isSignatureInsertionEnabled(documentType) {
    const settings = getSignatureSettings();
    const normalized = String(documentType || '').toLowerCase().trim();

    if (normalized === 'ppmp') {
        return settings.ppmp !== false;
    }
    if (normalized === 'app') {
        return settings.app !== false;
    }
    if (normalized === 'attachment_list' || normalized === 'attachment' || normalized === 'attachments') {
        return settings.attachment_list !== false;
    }

    return true;
}

export function useSignatureSettings() {
    const [settings, setSettings] = useState(() => getSignatureSettings());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleChange = (e) => {
            if (e.detail) {
                setSettings({ ...e.detail });
            }
        };

        window.addEventListener('signature_settings:changed', handleChange);

        setLoading(true);
        fetchSignatureSettings()
            .then((fresh) => {
                if (fresh) setSettings(fresh);
            })
            .finally(() => setLoading(false));

        return () => {
            window.removeEventListener('signature_settings:changed', handleChange);
        };
    }, []);

    const isEnabled = (documentType) => {
        const normalized = String(documentType || '').toLowerCase().trim();
        if (normalized === 'ppmp') return settings.ppmp !== false;
        if (normalized === 'app') return settings.app !== false;
        if (normalized === 'attachment_list' || normalized === 'attachment' || normalized === 'attachments') {
            return settings.attachment_list !== false;
        }
        return true;
    };

    return {
        settings,
        isEnabled,
        isPnpkiEnabled: settings.pnpki_enabled !== false,
        loading,
        setSettings: setLocalSignatureSettings,
    };
}

export function isSignatoryPnpkiActive(sigOrUser, fallbackUser = null) {
    if (!isPnpkiEnabled()) return false;

    const userObj = sigOrUser?.user || sigOrUser || fallbackUser || null;
    const pnpki =
        userObj?.pnpki_signature ||
        userObj?.pnpkiSignature ||
        sigOrUser?.pnpki_signature ||
        sigOrUser?.pnpkiSignature ||
        fallbackUser?.pnpki_signature ||
        fallbackUser?.pnpkiSignature ||
        null;

    if (!pnpki) return false;

    if (pnpki.effective_signature_type) {
        return pnpki.effective_signature_type === 'pnpki';
    }

    if (pnpki.signature_type !== 'pnpki') {
        return false;
    }

    if (pnpki.is_expired) {
        return false;
    }

    if (pnpki.expiration_date) {
        const exp = new Date(`${pnpki.expiration_date}T23:59:59`);
        if (!isNaN(exp.getTime()) && exp < new Date()) {
            return false;
        }
    }

    return true;
}

export function resolveSubmittedBySignatory() {
    return {
        user: null,
        isPnpkiActive: false,
        signedAt: null,
    };
}
