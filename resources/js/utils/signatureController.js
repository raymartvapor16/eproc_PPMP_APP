import { useState, useEffect } from 'react';
import { systemSettingService } from '../services/api';

const STORAGE_KEY = 'eproc_signature_settings';

const DEFAULT_SETTINGS = {
    ppmp: true,
    app: true,
    attachment_list: true,
};

let cachedSettings = null;

// Initialize cache from localStorage if available
function initCache() {
    if (cachedSettings !== null) return cachedSettings;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            cachedSettings = {
                ppmp: parsed.ppmp !== false,
                app: parsed.app !== false,
                attachment_list: parsed.attachment_list !== false,
            };
            return cachedSettings;
        }
    } catch (e) {
        // ignore parse error
    }
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
}

export function getSignatureSettings() {
    return initCache();
}

export function setLocalSignatureSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    cachedSettings = {
        ppmp: settings.ppmp !== false,
        app: settings.app !== false,
        attachment_list: settings.attachment_list !== false,
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
    } catch (e) {
        // ignore storage error
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

/**
 * Check if signature insertion is enabled for a document type.
 * @param {'ppmp' | 'app' | 'attachment_list'} documentType
 * @returns {boolean}
 */
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

/**
 * React hook to listen for signature setting changes dynamically
 */
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

        // Fetch latest settings from server in background
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
        loading,
        setSettings: setLocalSignatureSettings,
    };
}
