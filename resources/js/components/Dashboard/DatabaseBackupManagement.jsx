import React, { useState, useEffect } from 'react';
import {
    Database,
    Shield,
    ShieldAlert,
    ShieldCheck,
    KeyRound,
    Lock,
    Unlock,
    Download,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    HardDrive,
    Server,
    Calendar,
    User,
    Eye,
    EyeOff,
    FileCode,
    Check,
    X,
    FileLock2,
    Cpu,
    Upload,
    Terminal,
} from 'lucide-react';
import { databaseBackupService } from '../../services/api';

export const DatabaseBackupManagement = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notification, setNotification] = useState(null);

    // Active sub-view or tab: 'backup' | 'decrypt'
    const [activeTab, setActiveTab] = useState('backup');

    // Modals state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);

    // Password Setup / Change Form State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [passwordSubmitting, setPasswordSubmitting] = useState(false);
    const [passwordError, setPasswordError] = useState(null);

    // Download Authorization Form State
    const [downloadBackupPassword, setDownloadBackupPassword] = useState('');
    const [downloadAccountPassword, setDownloadAccountPassword] = useState('');
    const [showDownloadBackupPass, setShowDownloadBackupPass] = useState(false);
    const [showDownloadAccountPass, setShowDownloadAccountPass] = useState(false);
    const [encryptDump, setEncryptDump] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState(null);

    // Decrypt Tool State
    const [decryptFile, setDecryptFile] = useState(null);
    const [decryptPassword, setDecryptPassword] = useState('');
    const [showDecryptPass, setShowDecryptPass] = useState(false);
    const [decrypting, setDecrypting] = useState(false);
    const [decryptError, setDecryptError] = useState(null);

    const fetchStatus = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await databaseBackupService.getStatus();
            setStatus(res.data);
        } catch (e) {
            console.error('Failed to fetch backup status', e);
            setNotification({
                type: 'error',
                message: e.response?.data?.message || 'Failed to connect to Database Backup service.',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // Handle Setting or Updating Password
    const handleSavePassword = async (e) => {
        e.preventDefault();
        setPasswordError(null);

        if (status?.has_password && !currentPassword) {
            setPasswordError('Please enter your current backup security password.');
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            setPasswordError('The new backup password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('The new password and confirmation password do not match.');
            return;
        }

        setPasswordSubmitting(true);
        try {
            const payload = {
                password: newPassword,
                password_confirmation: confirmPassword,
            };
            if (status?.has_password) {
                payload.current_password = currentPassword;
            }

            const res = await databaseBackupService.setPassword(payload);
            setNotification({
                type: 'success',
                message: res.data?.message || 'Backup security password saved successfully.',
            });
            setShowPasswordModal(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            await fetchStatus();
        } catch (err) {
            const msg = err.response?.data?.errors?.current_password?.[0]
                || err.response?.data?.errors?.password?.[0]
                || err.response?.data?.message
                || 'Failed to update backup password.';
            setPasswordError(msg);
        } finally {
            setPasswordSubmitting(false);
        }
    };

    // Handle Dual-Factor Authorization & Single-Use Ephemeral Download
    const handleDownload = async (e) => {
        e.preventDefault();
        setDownloadError(null);

        if (!downloadBackupPassword) {
            setDownloadError('Please enter the manual backup security password.');
            return;
        }

        setDownloading(true);
        try {
            // Step 1: Request single-use ephemeral download token (verifies MFA & enforces anti-brute-force)
            const tokenRes = await databaseBackupService.requestToken({
                password: downloadBackupPassword,
                account_password: downloadAccountPassword || undefined,
                encrypt: encryptDump,
            });

            const token = tokenRes.data?.download_token;
            if (!token) {
                throw new Error('Server did not return a valid download authorization token.');
            }

            // Step 2: Download dump with single-use token (token burns immediately)
            const res = await databaseBackupService.downloadWithToken(token);

            let filename = `eproc_finalize_backup_${new Date().toISOString().slice(0, 10)}${encryptDump ? '.sql.enc' : '.sql'}`;
            const disposition = res.headers['content-disposition'];
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const blobType = encryptDump ? 'application/octet-stream' : 'application/sql';
            const blob = new Blob([res.data], { type: blobType });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            setNotification({
                type: 'success',
                message: `Protected backup file "${filename}" generated and downloaded successfully!`,
            });
            setShowDownloadModal(false);
            setDownloadBackupPassword('');
            setDownloadAccountPassword('');
            await fetchStatus();
        } catch (err) {
            let errorMsg = 'Failed to download database backup.';
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const parsed = JSON.parse(text);
                    errorMsg = parsed.message || parsed.errors?.password?.[0] || parsed.errors?.account_password?.[0] || errorMsg;
                } catch {
                    // fallback
                }
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            setDownloadError(errorMsg);
        } finally {
            setDownloading(false);
        }
    };

    // Handle Decrypting an Uploaded Encrypted Backup (.sql.enc)
    const handleDecrypt = async (e) => {
        e.preventDefault();
        setDecryptError(null);

        if (!decryptFile) {
            setDecryptError('Please select an encrypted (.sql.enc) file to decrypt.');
            return;
        }

        if (!decryptPassword) {
            setDecryptError('Please enter the backup security password used to encrypt this file.');
            return;
        }

        setDecrypting(true);
        try {
            const formData = new FormData();
            formData.append('backup_file', decryptFile);
            formData.append('password', decryptPassword);

            const res = await databaseBackupService.decryptBackup(formData);

            let outFilename = decryptFile.name.replace('.enc', '');
            if (!outFilename.endsWith('.sql')) {
                outFilename += '.sql';
            }

            const blob = new Blob([res.data], { type: 'application/sql' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = outFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            setNotification({
                type: 'success',
                message: `Encrypted backup successfully verified and decrypted as "${outFilename}"!`,
            });
            setDecryptFile(null);
            setDecryptPassword('');
        } catch (err) {
            let errorMsg = 'Decryption failed. Please check the password or file integrity.';
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const parsed = JSON.parse(text);
                    errorMsg = parsed.message || errorMsg;
                } catch {
                    // fallback
                }
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            }
            setDecryptError(errorMsg);
        } finally {
            setDecrypting(false);
        }
    };

    const hasPassword = Boolean(status?.has_password);
    const isLocked = Boolean(status?.is_locked);

    return (
        <div className="space-y-6">
            {/* Notification Banner */}
            {notification && (
                <div
                    className={`p-4 rounded-xl flex items-start justify-between gap-3 text-sm font-medium border shadow-xs animate-in fade-in duration-200 ${
                        notification.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <span>{notification.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNotification(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 shrink-0">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded-md text-indigo-700 text-[11px] font-black uppercase tracking-wider mb-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Enterprise-Grade Defense-in-Depth</span>
                            </div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">
                                High-Security Database Backup &amp; Recovery
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                                Export full encrypted snapshots protected with <strong>AES-256-GCM</strong> cipher, anti-brute-force rate limiting, dual-factor credential verification, and automatic session sanitization.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setActiveTab('backup')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === 'backup'
                                        ? 'bg-white text-blue-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export Dump</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('decrypt')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === 'decrypt'
                                        ? 'bg-white text-blue-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <FileLock2 className="w-3.5 h-3.5" />
                                <span>Decrypt Archive</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchStatus(true)}
                            disabled={refreshing || loading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                            title="Refresh Status"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
                            <span className="hidden sm:inline">{refreshing ? 'Checking...' : 'Refresh'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB: BACKUP EXPORT & SECURITY MANAGEMENT */}
            {activeTab === 'backup' && (
                <>
                    {/* Security Status Banner */}
                    {loading ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center text-slate-500 gap-3">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="text-xs font-semibold">Verifying database backup security status...</span>
                        </div>
                    ) : !hasPassword ? (
                        /* PASSWORD NOT CONFIGURED BANNER */
                        <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 rounded-2xl border-2 border-amber-300 p-6 shadow-xs">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 border border-amber-400/40">
                                        <KeyRound className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-extrabold text-amber-950">
                                                Action Required: Backup Security Password Not Created
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                                                Manual Setup Pending
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-900/80 mt-1 max-w-2xl leading-relaxed">
                                            For strict security, no default backup password is provided in database seeders. You must manually create a dedicated backup security password before database downloads can be unlocked.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setPasswordError(null);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setShowPasswordModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start md:self-auto shrink-0"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    <span>Create Backup Password</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* PASSWORD ACTIVE BANNER */
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-2xl border border-emerald-200 p-6 shadow-xs">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-400/40">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-extrabold text-emerald-950">
                                                Backup Security Password Configured &amp; Active
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                                                Protected
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-900/80 mt-1 max-w-2xl leading-relaxed">
                                            Database exports are secured against unauthorized access, network interception, and physical theft. Dual-factor authentication and anti-brute-force rate limiting are actively enforcing protection.
                                        </p>
                                        {status?.password_updated_at && (
                                            <div className="text-[11px] text-emerald-800/80 mt-1 flex items-center gap-1 font-medium">
                                                <Calendar className="w-3 h-3" />
                                                <span>Master key configured: {status.password_updated_at}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setPasswordError(null);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setShowPasswordModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer self-start md:self-auto shrink-0"
                                >
                                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Rotate / Change Password</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Threat Defense Highlights Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs mb-1">
                                <Cpu className="w-4 h-4" />
                                <span>AES-256-GCM Cipher</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                                PBKDF2 100,000-iteration key derivation + Galois Counter Mode. Uncrackable even if physical storage is stolen.
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs mb-1">
                                <Shield className="w-4 h-4" />
                                <span>Dual-Password Gate (MFA)</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                                Requires both Account Login Password and separate Backup Master Key to prevent unattended terminal misuse.
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-amber-600 font-bold text-xs mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Anti-Brute-Force Lockout</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                                Automatic 15-minute lockout after 3 consecutive failures + broadcast alert to all Super Administrators.
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs mb-1">
                                <FileCode className="w-4 h-4" />
                                <span>Zero-Token Sanitization</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                                Active session cookies, Sanctum API tokens, and backup password hashes are automatically stripped from the dump.
                            </p>
                        </div>
                    </div>

                    {/* Two-Column Overview & Action Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Database Metrics Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Server className="w-4 h-4 text-blue-600" />
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Database Environment
                                </h3>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Database Name:</span>
                                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                        {status?.database_name || 'eproc_finalize'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Total System Tables:</span>
                                    <span className="font-black text-slate-900">
                                        {status?.tables_count ?? '—'} tables
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Allocated Data Size:</span>
                                    <span className="font-black text-indigo-700">
                                        {status?.total_size_mb ? `${status.total_size_mb} MB` : '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Security Format:</span>
                                    <span className="font-mono text-[11px] font-semibold text-emerald-700">
                                        AES-256-GCM / SQL
                                    </span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
                                <div className="font-semibold text-slate-700">Audit Telemetry:</div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Last Download: {status?.last_backup_at || 'Never'}</span>
                                </div>
                                {status?.last_backup_by && (
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Authorized by: {status.last_backup_by}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Download Backup Action Card */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="space-y-3 relative z-10">
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded-md text-blue-300 text-[10px] font-black uppercase tracking-wider">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Hardened Export Protocol</span>
                                </div>

                                <h3 className="text-lg font-black tracking-tight text-white">
                                    Export Secure Database Backup
                                </h3>

                                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                                    Generates an authenticated, encrypted database dump protected with anti-tamper GCM authentication tags. Single-use download tokens burn instantly after download to eliminate link hijacking and network replay attacks.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-[11px] text-slate-300">
                                            Single-use 60s ephemeral token (zero replay)
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-[11px] text-slate-300">
                                            Strict anti-caching headers (no browser caching)
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                <div className="text-[11px] text-slate-400">
                                    {isLocked ? (
                                        <span className="text-rose-400 font-bold flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Download temporarily locked due to repeated failed attempts
                                        </span>
                                    ) : hasPassword ? (
                                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            Ready for export (dual password verification required)
                                        </span>
                                    ) : (
                                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Export locked until manual backup password is set
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => {
                                        if (!hasPassword) {
                                            setShowPasswordModal(true);
                                            return;
                                        }
                                        setDownloadError(null);
                                        setDownloadBackupPassword('');
                                        setDownloadAccountPassword('');
                                        setShowDownloadModal(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black tracking-wide uppercase transition shadow-lg cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>{hasPassword ? 'Export Secure Backup' : 'Create Password to Export'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* TAB: DECRYPT TOOL */}
            {activeTab === 'decrypt' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-[11px] font-black uppercase tracking-wider mb-2">
                            <FileLock2 className="w-3.5 h-3.5" />
                            <span>Recovery &amp; Decryption Utility</span>
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Decrypt AES-256-GCM Backup (.sql.enc)
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Need to restore a database backup or review its contents? Upload your downloaded <code className="text-indigo-600 font-mono">.sql.enc</code> file and provide your secret backup password to decrypt it into a standard MySQL <code className="text-indigo-600 font-mono">.sql</code> file.
                        </p>
                    </div>

                    <form onSubmit={handleDecrypt} className="space-y-4 max-w-xl">
                        {decryptError && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>{decryptError}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Select Encrypted Backup File (.sql.enc) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="file"
                                accept=".enc,.sql.enc,application/octet-stream"
                                onChange={(e) => setDecryptFile(e.target.files[0] || null)}
                                required
                                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Backup Security Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showDecryptPass ? 'text' : 'password'}
                                    value={decryptPassword}
                                    onChange={(e) => setDecryptPassword(e.target.value)}
                                    placeholder="Enter the secret backup password used when downloading"
                                    required
                                    className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowDecryptPass(!showDecryptPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    {showDecryptPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={decrypting || !decryptFile || !decryptPassword}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {decrypting ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Verifying &amp; Decrypting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Unlock className="w-3.5 h-3.5" />
                                        <span>Decrypt &amp; Download .sql</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Offline Terminal Decryption Reference */}
                    <div className="p-4 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2 font-bold text-white text-[11px] uppercase tracking-wider">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Offline Decryption Information</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Because E-PROC uses standard OpenSSL AES-256-GCM encryption with PBKDF2 key derivation, this tool allows Super Administrators to safely restore backups even during an offline disaster recovery procedure without exposing sensitive keys to unauthorized operators.
                        </p>
                    </div>
                </div>
            )}

            {/* ─── MODAL 1: DUAL-FACTOR AUTHORIZATION TO DOWNLOAD ─── */}
            {showDownloadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                        Dual-Factor Authorization Gate
                                    </h3>
                                    <p className="text-[11px] text-slate-300">
                                        Confirm physical identity and backup security master key
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDownloadModal(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleDownload} className="p-6 space-y-4">
                            {downloadError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <span>{downloadError}</span>
                                </div>
                            )}

                            {/* Factor 1: Account Login Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    1. Super Admin Account Password <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDownloadAccountPass ? 'text' : 'password'}
                                        value={downloadAccountPassword}
                                        onChange={(e) => setDownloadAccountPassword(e.target.value)}
                                        placeholder="Confirm your active login password"
                                        required
                                        autoFocus
                                        className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDownloadAccountPass(!showDownloadAccountPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showDownloadAccountPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Proves physical identity to guard against unattended workstation compromise.
                                </p>
                            </div>

                            {/* Factor 2: Manual Backup Security Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    2. Manual Backup Security Master Key <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDownloadBackupPass ? 'text' : 'password'}
                                        value={downloadBackupPassword}
                                        onChange={(e) => setDownloadBackupPassword(e.target.value)}
                                        placeholder="Enter the secret manual backup key"
                                        required
                                        className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDownloadBackupPass(!showDownloadBackupPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showDownloadBackupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    The separate manual backup security password you configured.
                                </p>
                            </div>

                            {/* Encryption Mode Radio / Selection */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Export Format &amp; Protection Level
                                </label>

                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="encryptDump"
                                        checked={encryptDump === true}
                                        onChange={() => setEncryptDump(true)}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                            <span>AES-256-GCM Encrypted Backup (.sql.enc)</span>
                                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded uppercase">
                                                Recommended
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Military-grade encrypted payload. Immune to physical theft, USB loss, and disk forensics.
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60">
                                    <input
                                        type="radio"
                                        name="encryptDump"
                                        checked={encryptDump === false}
                                        onChange={() => setEncryptDump(false)}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">
                                            Sanitized Plain MySQL Dump (.sql)
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Standard SQL file with session tokens, bearer keys, and password hashes sanitized.
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-[10px] text-slate-400">
                                    Token TTL: 60s single-use
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDownloadModal(false)}
                                        disabled={downloading}
                                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={downloading || !downloadBackupPassword || !downloadAccountPassword}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                        {downloading ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Authorizing &amp; Exporting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-3.5 h-3.5" />
                                                <span>Authorize &amp; Download</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL 2: CREATE OR ROTATE PASSWORD ─── */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-slate-950 to-indigo-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                    <KeyRound className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                        {hasPassword ? 'Rotate Backup Master Key' : 'Create Backup Password'}
                                    </h3>
                                    <p className="text-[11px] text-slate-300">
                                        {hasPassword
                                            ? 'Change your secret database export password'
                                            : 'Set a manual password required for all database downloads'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPasswordModal(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePassword} className="p-6 space-y-4">
                            {passwordError && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            {/* Current Password (only when updating) */}
                            {hasPassword && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Current Backup Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPass ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter current backup password"
                                            required
                                            className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* New Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    {hasPassword ? 'New Backup Password' : 'Create Backup Password'}{' '}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        minLength={8}
                                        required
                                        className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Choose a strong password (minimum 8 characters). This password is encrypted using bcrypt.
                                </p>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Confirm Backup Password <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPass ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-type new backup password"
                                        minLength={8}
                                        required
                                        className="w-full px-3.5 py-2.5 pr-10 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    disabled={passwordSubmitting}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={passwordSubmitting || !newPassword || !confirmPassword}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {passwordSubmitting ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Saving Key...</span>
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound className="w-3.5 h-3.5" />
                                            <span>{hasPassword ? 'Update Password' : 'Save Password'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
