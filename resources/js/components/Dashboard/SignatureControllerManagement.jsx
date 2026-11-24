import React, { useState, useEffect } from 'react';
import {
    PenTool,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Sliders,
    FileText,
    FileSpreadsheet,
    Layers,
    Shield,
    Check,
    X,
    Sparkles,
} from 'lucide-react';
import { systemSettingService } from '../../services/api';
import {
    getSignatureSettings,
    setLocalSignatureSettings,
    fetchSignatureSettings,
} from '../../utils/signatureController';

export const SignatureControllerManagement = ({ onSettingsUpdated = null }) => {
    const [settings, setSettings] = useState(() => getSignatureSettings());
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);
    const [notification, setNotification] = useState(null);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await fetchSignatureSettings();
            if (data) {
                setSettings({ ...data });
            }
        } catch (e) {
            console.error('Failed to load signature settings:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();

        const handleSettingsChanged = (e) => {
            if (e.detail) {
                setSettings({ ...e.detail });
            }
        };

        window.addEventListener('signature_settings:changed', handleSettingsChanged);
        return () => window.removeEventListener('signature_settings:changed', handleSettingsChanged);
    }, []);

    const handleToggle = async (key) => {
        const nextValue = !settings[key];
        const nextSettings = {
            ...settings,
            [key]: nextValue,
        };

        setSavingKey(key);
        setNotification(null);

        try {
            const res = await systemSettingService.updateSignatureSettings(nextSettings);
            const saved = res.data?.settings || nextSettings;
            setSettings(saved);
            setLocalSignatureSettings(saved);

            if (onSettingsUpdated) {
                onSettingsUpdated(saved);
            }

            const docName =
                key === 'pnpki_enabled'
                    ? 'PNPKI Digital E-Signature System'
                    : key === 'ppmp'
                      ? 'PPMP'
                      : key === 'app'
                        ? 'APP'
                        : 'Detailed Specifications';
            setNotification({
                type: 'success',
                message:
                    key === 'pnpki_enabled'
                        ? `PNPKI Digital E-Signature System is now ${nextValue ? 'ENABLED (ON)' : 'DISABLED (OFF)'}. ${
                              nextValue
                                  ? 'Users can select PNPKI Digital E-Signature on registration and active PNPKI signatures display on print documents.'
                                  : 'Registration only shows Optional Digital Signature. E-signatures still display on-screen in PPMP, APP, and Detailed Specifications, and are removed on Print / Download PDF.'
                          }`
                        : `${docName} signature insertion is now ${nextValue ? 'ENABLED (ON)' : 'DISABLED (OFF)'}. All users and reviewers will follow this setting.`,
            });
        } catch (e) {
            const err = e.response?.data?.message || 'Failed to update signature settings. Only Super Administrators are authorized.';
            setNotification({
                type: 'error',
                message: err,
            });
        } finally {
            setSavingKey(null);
        }
    };

    const handleMasterToggle = async (turnOn) => {
        const nextSettings = {
            ppmp: Boolean(turnOn),
            app: Boolean(turnOn),
            attachment_list: Boolean(turnOn),
        };

        setSavingKey('all');
        setNotification(null);

        try {
            const res = await systemSettingService.updateSignatureSettings(nextSettings);
            const saved = res.data?.settings || nextSettings;
            setSettings(saved);
            setLocalSignatureSettings(saved);

            if (onSettingsUpdated) {
                onSettingsUpdated(saved);
            }

            setNotification({
                type: 'success',
                message: `All document signatures (PPMP, APP, Attachments) are now ${turnOn ? 'ENABLED (ON)' : 'DISABLED (OFF)'}.`,
            });
        } catch (e) {
            const err = e.response?.data?.message || 'Failed to update signature settings. Only Super Administrators are authorized.';
            setNotification({
                type: 'error',
                message: err,
            });
        } finally {
            setSavingKey(null);
        }
    };

    const isAllOn = settings.ppmp && settings.app && settings.attachment_list;
    const isAllOff = !settings.ppmp && !settings.app && !settings.attachment_list;

    const sections = [
        {
            key: 'ppmp',
            title: 'PPMP Signatures',
            subtitle: 'Project Procurement Management Plan',
            description:
                'When ON: Active PNPKI Digital E-Signatures display with Date/Time on both the PPMP screen and Print/Save PDF. Optional Digital Signatures display on the PPMP screen only and are hidden (signature + Date/Time) on Print/Save PDF.',
            icon: FileText,
            color: 'indigo',
            roles: ['End-User', 'Office Head', 'Budget Officer (PBO)', 'Provincial Accountant (PACCO)', 'OPPMO - BAC Secretariat', 'Provincial Governor'],
        },
        {
            key: 'app',
            title: 'APP Signatures',
            subtitle: 'Annual Procurement Plan (Consolidated)',
            description:
                'When ON: Active PNPKI Digital E-Signatures display on consolidated APP views and Print/Save PDF. Optional Digital Signatures display on screen only and are hidden on Print/Save PDF.',
            icon: FileSpreadsheet,
            color: 'emerald',
            roles: ['Prepared by (ADAS II)', 'Checked by (PGDH - OPPMO)', 'BAC Members', 'BAC Chairman (PBO)', 'Provincial Governor'],
        },
        {
            key: 'attachment_list',
            title: 'Detailed Specifications Signatures',
            subtitle: 'Annexes, Attachments & Certification Sheets',
            description:
                'When ON: Active PNPKI Digital E-Signatures display with Date/Time on Detailed Specifications on screen and Print/Save PDF. Optional Digital Signatures display on screen only and are hidden (signature + Date/Time) on Print/Save PDF.',
            icon: Layers,
            color: 'blue',
            roles: ['End-User / Implementing Unit', 'Office Head Endorsement', 'BAC-TWG Approval'],
        },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                                <Shield className="w-3 h-3" />
                                Super Admin Controller
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                PNPKI &amp; Optional Signature Governance
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                <Sliders className="w-3 h-3" />
                                Global Governance
                            </span>
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-indigo-600" />
                            Electronic Signature &amp; PNPKI Print/PDF Controller
                        </h2>
                        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                            Master switch for document signature insertion across <strong>PPMP</strong>, <strong>APP</strong>, and <strong>Detailed Specifications</strong>.
                            Users with an active <strong>PNPKI Digital E-Signature</strong> display their e-signature and Date/Time on screen and on <strong>Print / Save PDF</strong>.
                            Users with an <strong>Optional Digital Signature</strong> display their signature on screen, but <strong>do not display the signature or Date/Time on Print / Save PDF</strong>.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleMasterToggle(true)}
                            disabled={loading || savingKey !== null || isAllOn}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                                isAllOn
                                    ? 'bg-emerald-50 text-emerald-400 border border-emerald-200 cursor-not-allowed opacity-60'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="Turn ON signature insertion for all documents"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>All Signatures ON</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleMasterToggle(false)}
                            disabled={loading || savingKey !== null || isAllOff}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                                isAllOff
                                    ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                            title="Turn OFF signature insertion for all documents"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>All Signatures OFF</span>
                        </button>

                        <button
                            type="button"
                            onClick={loadSettings}
                            disabled={loading || savingKey !== null}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            title="Reload signature settings"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {notification && (
                <div
                    className={`mx-6 mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                        notification.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    {notification.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span className="font-semibold leading-relaxed">{notification.message}</span>
                </div>
            )}

            <div className="px-6 pt-5 pb-1">
                <div
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        settings.pnpki_enabled !== false
                            ? 'border-indigo-300 bg-gradient-to-r from-indigo-50/60 via-white to-blue-50/40'
                            : 'border-slate-300 bg-slate-50/80'
                    }`}
                >
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                                <Shield className={`w-4 h-4 ${settings.pnpki_enabled !== false ? 'text-indigo-600' : 'text-slate-500'}`} />
                                Use PNPKI Digital E-Signature System (Enable / Disable)
                            </span>
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                    settings.pnpki_enabled !== false
                                        ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                        : 'bg-slate-200 text-slate-700 border-slate-300'
                                }`}
                            >
                                {settings.pnpki_enabled !== false ? 'PNPKI E-Sig Enabled' : 'PNPKI E-Sig Disabled'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                            {settings.pnpki_enabled !== false
                                ? 'When ENABLED: Users registering an account can choose between PNPKI Digital E-Signature and Optional Digital Signature, and valid PNPKI e-signatures appear on PPMP print documents.'
                                : 'When DISABLED: Registration only shows Optional Digital Signature (no PNPKI option). E-signatures still display on-screen in PPMP, APP, and Detailed Specifications, but are automatically removed on Print or Download/Export PDF (empty signature space, no Date/Time, no bottom certification sentence).'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                        <span className="text-xs font-bold text-slate-700 uppercase">
                            {settings.pnpki_enabled !== false ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleToggle('pnpki_enabled')}
                            disabled={loading || savingKey !== null}
                            aria-pressed={settings.pnpki_enabled !== false}
                            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                                settings.pnpki_enabled !== false ? 'bg-indigo-600' : 'bg-slate-300'
                            }`}
                        >
                            <span className="sr-only">Toggle PNPKI Digital E-Signature System</span>
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                    settings.pnpki_enabled !== false ? 'translate-x-7' : 'translate-x-0'
                                }`}
                            >
                                {savingKey === 'pnpki_enabled' ? (
                                    <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                                ) : settings.pnpki_enabled !== false ? (
                                    <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
                                ) : (
                                    <X className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
                                )}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 pt-5 pb-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                            1. PNPKI Digital E-Signature (Active Certificate)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                            Print &amp; PDF Enabled
                        </span>
                    </div>
                    <ul className="text-[11px] text-slate-700 space-y-1 leading-relaxed">
                        <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span><strong>PPMP &amp; Detailed Specifications (On-Screen):</strong> Displays E-Sig + Date &amp; Time</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span><strong>Printing &amp; Save/Import PDF:</strong> Displays E-Sig + Date &amp; Time</span>
                        </li>
                    </ul>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                            <PenTool className="w-4 h-4 text-blue-600 shrink-0" />
                            2. Optional Digital Signature (or Expired PNPKI)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                            Hidden on Print / PDF
                        </span>
                    </div>
                    <ul className="text-[11px] text-slate-700 space-y-1 leading-relaxed">
                        <li className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span><strong>PPMP &amp; Detailed Specifications (On-Screen):</strong> Displays Signature + Date &amp; Time</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span><strong>Printing &amp; Save/Import PDF:</strong> Does <strong>NOT</strong> display Signature or Date &amp; Time</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                {sections.map((section) => {
                    const Icon = section.icon;
                    const isOn = Boolean(settings[section.key]);
                    const isSaving = savingKey === section.key || savingKey === 'all';

                    return (
                        <div
                            key={section.key}
                            className={`rounded-2xl border-2 transition-all duration-300 p-5 flex flex-col justify-between shadow-xs ${
                                isOn
                                    ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20'
                                    : 'border-slate-200 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30'
                            }`}
                        >
                            <div>

                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                                isOn ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                            }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                                {section.subtitle}
                                            </span>
                                            <h3 className="text-sm font-black text-slate-900 leading-tight">
                                                {section.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleToggle(section.key)}
                                        disabled={loading || savingKey !== null}
                                        aria-pressed={isOn}
                                        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                            isOn ? 'bg-emerald-600' : 'bg-slate-300'
                                        }`}
                                    >
                                        <span className="sr-only">Toggle {section.title}</span>
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                                isOn ? 'translate-x-7' : 'translate-x-0'
                                            }`}
                                        >
                                            {isSaving ? (
                                                <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                                            ) : isOn ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                            ) : (
                                                <X className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
                                            )}
                                        </span>
                                    </button>
                                </div>

                                <div className="mb-3">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
                                            isOn
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                                        }`}
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full ${
                                                isOn ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
                                            }`}
                                        />
                                        {isOn ? 'Signatures Inserted (ON)' : 'Signatures Suppressed (OFF)'}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                    {section.description}
                                </p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 mt-auto">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Signatories Bound by this Controller:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {section.roles.map((r, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 shadow-2xs"
                                        >
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                        Changes take effect immediately across all active screens and print views. No server restart required.
                    </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                    SystemSetting key: signature_insertion_*
                </span>
            </div>
        </div>
    );
};

export default SignatureControllerManagement;
