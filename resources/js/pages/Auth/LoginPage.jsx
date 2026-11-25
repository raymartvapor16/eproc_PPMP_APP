import React, { useState, useEffect, useRef } from 'react';

import { authService, portalSystemService, systemSettingService } from '../../services/api';
import { REGISTRATION_ROLE_OPTIONS, getRoleInfo } from '../../utils/roleLabels';
import {
    Shield,
    Lock,
    Mail,
    User as UserIcon,
    Building2,
    Briefcase,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    Search,
    ChevronDown,
    X,
    Check,
    Phone,
    MapPin,
    Clock,
    RefreshCw,
    PenTool,
    Eraser,
    FileText,
    FileUp,
    ShieldCheck,
    Sparkles,
    FileCheck2,
    Send,
    Layers,
    Compass,
    Maximize2,
    Eye,
    EyeOff,
    Award
} from 'lucide-react';
import { SignaturePadModal } from '../../components/UI/SignaturePadModal';
import { SpiderParticlesCanvas } from '../../components/UI/SpiderParticlesCanvas';
import { AccountCodeMultiSelect } from '../../components/UI/AccountCodeMultiSelect';
import { CloudflareSecurityVerification } from '../../components/UI/CloudflareSecurityVerification';
import { useSignatureSettings } from '../../utils/signatureController';

export const LoginPage = ({ onLoginSuccess, onOpenPrivacy, onBackToLanding, initialError = '', targetSystem = 'dashboard' }) => {
    const [mode, setMode] = useState('login');
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(initialError || '');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (initialError) {
            setError(initialError);
        }
    }, [initialError]);

    useEffect(() => {
        const handleDevToolsUnauthorized = (e) => {
            if (e.detail?.message) {
                setError(e.detail.message);
            }
        };
        window.addEventListener('devtools:unauthorized', handleDevToolsUnauthorized);
        return () => window.removeEventListener('devtools:unauthorized', handleDevToolsUnauthorized);
    }, []);

    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
    const [registerData, setRegisterData] = useState({
        name: '',
        email: '',
        role: '',
        phone_number: '',
        address: '',
        office_id: '',
        designation: '',
        password: '',
        password_confirmation: '',
    });
    const [authorizationLetter, setAuthorizationLetter] = useState(null);
    const [authorizationLetterError, setAuthorizationLetterError] = useState('');
    const [selectedAccountCodeIds, setSelectedAccountCodeIds] = useState([]);
    const authLetterInputRef = useRef(null);

    const validateAndSetAuthorizationLetter = (file, inputElement = null) => {
        if (!file) {
            setAuthorizationLetter(null);
            return;
        }

        const filename = String(file.name || '').toLowerCase();
        const isPdfExt = filename.endsWith('.pdf');

        if (!isPdfExt) {
            setAuthorizationLetter(null);
            if (inputElement) inputElement.value = '';
            setAuthorizationLetterError(`Security Restriction: "${file.name}" is not a valid PDF document. Only official signed PDF files (.pdf) are permitted. Other file formats (e.g. .url, shortcuts, executables) are strictly blocked.`);
            return;
        }

        if (/\.(php|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.pdf$/i.test(filename)) {
            setAuthorizationLetter(null);
            if (inputElement) inputElement.value = '';
            setAuthorizationLetterError(`Security Warning: Suspicious disguised file naming detected for "${file.name}". Upload rejected.`);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setAuthorizationLetter(null);
            if (inputElement) inputElement.value = '';
            setAuthorizationLetterError(`File size exceeds the 5MB maximum limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Only PDF files up to 5MB are permitted.`);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = (e) => {
            try {
                const arr = new Uint8Array(e.target.result);
                const header = String.fromCharCode(...arr.slice(0, 5));
                if (header !== '%PDF-') {
                    setAuthorizationLetter(null);
                    if (inputElement) inputElement.value = '';
                    setAuthorizationLetterError(`Security Violation: "${file.name}" does not contain a genuine PDF file signature (%PDF- header). Upload rejected.`);
                    return;
                }

                setAuthorizationLetterError('');
                setAuthorizationLetter(file);
            } catch (err) {
                setAuthorizationLetterError('Failed to verify document signature.');
            }
        };
        reader.onerror = () => {
            setAuthorizationLetter(null);
            if (inputElement) inputElement.value = '';
            setAuthorizationLetterError('Unable to read selected file.');
        };
        reader.readAsArrayBuffer(file.slice(0, 64));
    };
    const [offices, setOffices] = useState([]);
    const [loadingOffices, setLoadingOffices] = useState(false);

    const [availableSystems, setAvailableSystems] = useState([]);
    const [loadingSystems, setLoadingSystems] = useState(true);
    const [selectedSystems, setSelectedSystems] = useState([]);
    const [isSystemsDropdownOpen, setIsSystemsDropdownOpen] = useState(false);
    const systemsDropdownRef = useRef(null);

    const [selectedRoles, setSelectedRoles] = useState([]);
    const [isRolesDropdownOpen, setIsRolesDropdownOpen] = useState(false);
    const rolesDropdownRef = useRef(null);
    const [roleSelectionModal, setRoleSelectionModal] = useState(null);
    const [chosenLoginRole, setChosenLoginRole] = useState('');
    const [selectingRoleLoading, setSelectingRoleLoading] = useState(false);

    const [mfaModal, setMfaModal] = useState(null);
    const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaResending, setMfaResending] = useState(false);
    const [mfaError, setMfaError] = useState('');
    const [mfaInfo, setMfaInfo] = useState('');
    const [mfaExpiresLeft, setMfaExpiresLeft] = useState(0);
    const [mfaResendCooldown, setMfaResendCooldown] = useState(0);
    const mfaInputRefs = useRef([]);

    useEffect(() => {
        if (!mfaModal) return;
        const timer = setInterval(() => {
            setMfaExpiresLeft((prev) => (prev > 0 ? prev - 1 : 0));
            setMfaResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [mfaModal]);

    const openMfaChallenge = (data) => {
        setMfaModal({
            token: data.mfa_token,
            maskedEmail: data.masked_email || 'sys***16@gmail.com',
        });
        setMfaDigits(['', '', '', '', '', '']);
        setMfaError('');
        setMfaInfo(data.message || 'Enter the 6-digit verification code sent to the designated Super Admin email.');
        setMfaExpiresLeft(Number(data.expires_in || 300));
        setMfaResendCooldown(Number(data.resend_cooldown || 60));
        setTimeout(() => mfaInputRefs.current[0]?.focus(), 80);
    };

    const closeMfaModal = () => {
        if (mfaLoading) return;
        setMfaModal(null);
        setMfaDigits(['', '', '', '', '', '']);
        setMfaError('');
        setMfaInfo('');
        setLoginTurnstileReset((prev) => prev + 1);
    };

    const handleMfaDigitChange = (idx, rawVal) => {
        const cleaned = String(rawVal || '').replace(/\D/g, '');
        if (!cleaned) {
            setMfaDigits((prev) => {
                const next = [...prev];
                next[idx] = '';
                return next;
            });
            return;
        }
        if (cleaned.length > 1) {
            const chars = cleaned.slice(0, 6).split('');
            setMfaDigits((prev) => {
                const next = [...prev];
                chars.forEach((ch, offset) => {
                    if (idx + offset < 6) next[idx + offset] = ch;
                });
                return next;
            });
            const nextFocus = Math.min(5, idx + chars.length);
            mfaInputRefs.current[nextFocus]?.focus();
            return;
        }
        setMfaDigits((prev) => {
            const next = [...prev];
            next[idx] = cleaned;
            return next;
        });
        if (idx < 5) {
            mfaInputRefs.current[idx + 1]?.focus();
        }
    };

    const handleMfaKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !mfaDigits[idx] && idx > 0) {
            mfaInputRefs.current[idx - 1]?.focus();
        }
    };

    const handleMfaPaste = (e) => {
        const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        e.preventDefault();
        const next = ['', '', '', '', '', ''];
        pasted.split('').forEach((ch, i) => {
            next[i] = ch;
        });
        setMfaDigits(next);
        const focusIdx = Math.min(5, pasted.length);
        mfaInputRefs.current[focusIdx]?.focus();
    };

    const handleVerifyMfa = async (e) => {
        e.preventDefault();
        if (!mfaModal?.token || mfaLoading) return;
        const code = mfaDigits.join('');
        if (code.length !== 6) {
            setMfaError('Please enter all 6 digits of the verification code.');
            return;
        }
        setMfaLoading(true);
        setMfaError('');
        try {
            const res = await authService.verifyMfa({
                mfa_token: mfaModal.token,
                code,
            });
            setMfaModal(null);
            setMfaDigits(['', '', '', '', '', '']);
            onLoginSuccess(res.data.user);
        } catch (err) {
            const msg = err.response?.data?.message || 'Invalid or expired verification code.';
            setMfaError(msg);
            setMfaDigits(['', '', '', '', '', '']);
            setTimeout(() => mfaInputRefs.current[0]?.focus(), 50);
            if (err.response?.data?.expired || err.response?.status === 429 || err.response?.status === 403) {
                setError(msg);
                setMfaModal(null);
                setLoginTurnstileReset((prev) => prev + 1);
            }
        } finally {
            setMfaLoading(false);
        }
    };

    const handleResendMfa = async () => {
        if (!mfaModal?.token || mfaResending || mfaResendCooldown > 0) return;
        setMfaResending(true);
        setMfaError('');
        try {
            const res = await authService.resendMfa({ mfa_token: mfaModal.token });
            setMfaInfo(res.data?.message || 'A new 6-digit verification code has been sent.');
            setMfaDigits(['', '', '', '', '', '']);
            setMfaExpiresLeft(Number(res.data?.expires_in || 300));
            setMfaResendCooldown(Number(res.data?.resend_cooldown || 60));
            setTimeout(() => mfaInputRefs.current[0]?.focus(), 50);
        } catch (err) {
            const msg = err.response?.data?.message || 'Unable to resend verification code.';
            setMfaError(msg);
            if (err.response?.data?.retry_after) {
                setMfaResendCooldown(Number(err.response.data.retry_after));
            }
        } finally {
            setMfaResending(false);
        }
    };

    useEffect(() => {
        if (!isRolesDropdownOpen) return;
        const handleOutside = (e) => {
            if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(e.target)) {
                setIsRolesDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isRolesDropdownOpen]);

    const toggleRegisterRole = (roleValue) => {
        setSelectedRoles((prev) => {
            const next = prev.includes(roleValue)
                ? prev.filter((r) => r !== roleValue)
                : [...prev, roleValue];
            setRegisterData((rd) => ({ ...rd, role: next[0] || '' }));
            return next;
        });
    };

    const [turnstileEnabled, setTurnstileEnabled] = useState(() => window.App?.turnstile_enabled !== false);
    const [loginTurnstileToken, setLoginTurnstileToken] = useState('');
    const [loginTurnstileReset, setLoginTurnstileReset] = useState(0);
    const [registerTurnstileToken, setRegisterTurnstileToken] = useState('');
    const [registerTurnstileReset, setRegisterTurnstileReset] = useState(0);

    useEffect(() => {
        let isMounted = true;
        systemSettingService.getTurnstileSettings()
            .then((res) => {
                if (isMounted && res?.data && typeof res.data.enabled !== 'undefined') {
                    const enabledVal = Boolean(res.data.enabled);
                    setTurnstileEnabled(enabledVal);
                    if (window.App) {
                        window.App.turnstile_enabled = enabledVal;
                    }
                }
            })
            .catch(() => {});

        const handleTurnstileChanged = (e) => {
            if (e.detail && typeof e.detail.enabled !== 'undefined') {
                setTurnstileEnabled(Boolean(e.detail.enabled));
            }
        };

        window.addEventListener('turnstile_settings:changed', handleTurnstileChanged);
        return () => {
            isMounted = false;
            window.removeEventListener('turnstile_settings:changed', handleTurnstileChanged);
        };
    }, []);

    const { isPnpkiEnabled } = useSignatureSettings();
    const [hasSignature, setHasSignature] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [signatureDataUrl, setSignatureDataUrl] = useState(null);
    const [signatureMeta, setSignatureMeta] = useState({
        signatureType: 'optional',
        expirationDate: '',
        pnpkiProofFile: null,
        existingProofName: '',
        captureMethod: 'drawn',
    });

    useEffect(() => {
        if (!isPnpkiEnabled && signatureMeta.signatureType === 'pnpki') {
            setSignatureMeta((prev) => ({
                ...prev,
                signatureType: 'optional',
            }));
        }
    }, [isPnpkiEnabled, signatureMeta.signatureType]);

    const clearSignature = (e) => {
        if (e) e.stopPropagation();
        setHasSignature(false);
        setSignatureDataUrl(null);
        setSignatureMeta({
            signatureType: 'optional',
            expirationDate: '',
            pnpkiProofFile: null,
            existingProofName: '',
            captureMethod: 'drawn',
        });
    };

    const handleApplyModalSignature = (dataUrl, meta = null) => {
        if (dataUrl) {
            setSignatureDataUrl(dataUrl);
            setHasSignature(true);
            if (meta) {
                setSignatureMeta({
                    signatureType: meta.signatureType || 'optional',
                    expirationDate: meta.expirationDate || '',
                    pnpkiProofFile: meta.pnpkiProofFile || null,
                    existingProofName: meta.existingProofName || meta.pnpkiProofFile?.name || '',
                    captureMethod: meta.captureMethod || 'drawn',
                });
            }
        } else {
            clearSignature();
        }
    };

    const [officeSearchTerm, setOfficeSearchTerm] = useState('');
    const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
    const officeDropdownRef = useRef(null);

    const [showPendingModal, setShowPendingModal] = useState(false);

    useEffect(() => {
        const fetchOffices = async () => {
            setLoadingOffices(true);
            try {
                const res = await authService.getPublicOffices();
                setOffices(res.data || []);
            } catch (err) {
                console.error('Failed to load offices for registration', err);
            } finally {
                setLoadingOffices(false);
            }
        };
        fetchOffices();

        const fetchSystems = async () => {
            setLoadingSystems(true);
            try {
                const res = await portalSystemService.getPublic();
                const list = Array.isArray(res.data) ? res.data : [];
                const activeList = list.filter((sys) => !sys.status || sys.status === 'active');
                setAvailableSystems(activeList);
                const validUrls = new Set(activeList.map((s) => s.link_url));
                setSelectedSystems((prev) => prev.filter((url) => validUrls.has(url)));
            } catch (err) {
                console.error('Failed to load portal systems for registration', err);
                setAvailableSystems([]);
            } finally {
                setLoadingSystems(false);
            }
        };
        fetchSystems();

        window.addEventListener('portal-systems:updated', fetchSystems);
        return () => window.removeEventListener('portal-systems:updated', fetchSystems);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (officeDropdownRef.current && !officeDropdownRef.current.contains(event.target)) {
                setIsOfficeDropdownOpen(false);
            }
            if (systemsDropdownRef.current && !systemsDropdownRef.current.contains(event.target)) {
                setIsSystemsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOffices = offices.filter((off) => {
        if (!officeSearchTerm.trim()) return true;
        const term = officeSearchTerm.toLowerCase();
        return (
            (off.name && off.name.toLowerCase().includes(term)) ||
            (off.code && off.code.toLowerCase().includes(term)) ||
            (off.head_name && off.head_name.toLowerCase().includes(term))
        );
    });

    const selectedOffice = offices.find((o) => String(o.id) === String(registerData.office_id));

    const handleSelectOffice = (office) => {
        setRegisterData({ ...registerData, office_id: office.id });
        setOfficeSearchTerm('');
        setIsOfficeDropdownOpen(false);
    };

    const handleClearOffice = (e) => {
        e.stopPropagation();
        setRegisterData({ ...registerData, office_id: '' });
        setOfficeSearchTerm('');
    };

    const [lockoutSeconds, setLockoutSeconds] = useState(0);

    useEffect(() => {
        let timer;
        if (lockoutSeconds > 0) {
            timer = setInterval(() => {
                setLockoutSeconds((prev) => {
                    if (prev <= 1) {
                        setError('');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [lockoutSeconds]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (lockoutSeconds > 0) return;

        if (turnstileEnabled && !loginTurnstileToken) {
            setError('Please wait for or complete the Cloudflare security verification to confirm that you are human.');
            return;
        }

        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await authService.login({
                email,
                password,
                cf_turnstile_response: loginTurnstileToken,
            });
            if (res.data?.requires_mfa && res.data?.mfa_token) {
                openMfaChallenge(res.data);
                return;
            }
            if (res.data?.requires_role_selection && Array.isArray(res.data?.available_roles)) {
                setRoleSelectionModal({
                    token: res.data.role_selection_token,
                    availableRoles: res.data.available_roles,
                    currentRole: res.data.current_role || res.data.available_roles[0],
                    userPreview: res.data.user_preview || { email },
                });
                setChosenLoginRole(res.data.current_role || res.data.available_roles[0] || '');
                return;
            }
            onLoginSuccess(res.data.user);
        } catch (err) {
            const serverMsg = err.response?.data?.message || 'Invalid credentials or inactive account.';
            setError(serverMsg);
            setLoginTurnstileReset((prev) => prev + 1);

            if (err.response?.status === 429 && err.response?.data?.retry_after) {
                setLockoutSeconds(err.response.data.retry_after);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRoleLogin = async (targetRole) => {
        const roleToUse = targetRole || chosenLoginRole;
        if (!roleSelectionModal?.token || !roleToUse || selectingRoleLoading) return;
        setSelectingRoleLoading(true);
        setError('');
        try {
            const res = await authService.login({
                role_selection_token: roleSelectionModal.token,
                selected_role: roleToUse,
            });
            setRoleSelectionModal(null);
            setChosenLoginRole('');
            if (res.data?.requires_mfa && res.data?.mfa_token) {
                openMfaChallenge(res.data);
                return;
            }
            onLoginSuccess(res.data.user);
        } catch (err) {
            const serverMsg = err.response?.data?.message || 'Unable to sign in with the selected role. Please sign in again.';
            setRoleSelectionModal(null);
            setError(serverMsg);
            setLoginTurnstileReset((prev) => prev + 1);
        } finally {
            setSelectingRoleLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!registerData.name?.trim()) {
            setError('Please enter your full official name.');
            return;
        }

        if (!registerData.email?.trim()) {
            setError('Please enter your official email address.');
            return;
        }

        if (!registerData.phone_number?.trim()) {
            setError('Please enter your contact phone number.');
            return;
        }

        if (!registerData.address?.trim()) {
            setError('Please enter the user address.');
            return;
        }

        if (!registerData.office_id) {
            setError('Please select your assigned office / department.');
            return;
        }

        if (!selectedRoles || selectedRoles.length === 0) {
            setError('Please select at least one system role.');
            return;
        }

        if (!registerData.designation?.trim()) {
            setError('Please enter your official position / designation.');
            return;
        }

        if (!registerData.password) {
            setError('Please enter your account password.');
            return;
        }

        if (registerData.password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (registerData.password !== registerData.password_confirmation) {
            setError('Passwords do not match.');
            return;
        }

        if (selectedRoles.includes('authorized_staff')) {
            if (!authorizationLetter) {
                setError('Please attach the official Authorization Letter (PDF) signed by the Office Head.');
                return;
            }
            if (authorizationLetter.type !== 'application/pdf' && !authorizationLetter.name.toLowerCase().endsWith('.pdf')) {
                setError('Only official PDF documents (.pdf) are accepted for the Authorization Letter.');
                return;
            }
            if (authorizationLetter.size > 5 * 1024 * 1024) {
                setError('Authorization Letter exceeds the 5MB maximum limit. Please upload a PDF up to 5MB.');
                return;
            }
        }

        if (selectedRoles.includes('twg') && (!selectedAccountCodeIds || selectedAccountCodeIds.length === 0)) {
            setError('Please select at least one assigned Account Code for the BAC-TWG Reviewer role.');
            return;
        }

        if (!hasSignature || !signatureDataUrl) {
            setError(
                isPnpkiEnabled
                    ? 'Please open the Signature Studio to configure your PNPKI or Optional Digital Signature.'
                    : 'Please open the Signature Studio to configure your Optional Digital Signature.'
            );
            setIsSignatureModalOpen(true);
            return;
        }

        if (isPnpkiEnabled && signatureMeta.signatureType === 'pnpki') {
            if (!signatureMeta.expirationDate) {
                setError('Please select the expiration date for your PNPKI Digital E-Signature.');
                setIsSignatureModalOpen(true);
                return;
            }
            if (!signatureMeta.pnpkiProofFile) {
                setError('Please attach the PDF Proof of Registration of PNPKI (maximum 5MB).');
                setIsSignatureModalOpen(true);
                return;
            }
        }

        if (turnstileEnabled && !registerTurnstileToken) {
            setError('Please wait for or complete the Cloudflare security verification to confirm that you are human.');
            return;
        }

        if (!selectedSystems || selectedSystems.length === 0) {
            setError('Please select at least one digital system to request access for.');
            return;
        }

        setLoading(true);

        try {

            const finalSigUrl = hasSignature ? signatureDataUrl : null;
            const hasMultipartFiles = Boolean(authorizationLetter || signatureMeta.pnpkiProofFile);

            let payload;
            if (hasMultipartFiles) {
                payload = new FormData();
                Object.keys(registerData).forEach((key) => {
                    if (key === 'role') {
                        payload.append('role', selectedRoles[0] || '');
                    } else {
                        payload.append(key, registerData[key]);
                    }
                });
                payload.append('roles', JSON.stringify(selectedRoles));
                payload.append('signature', finalSigUrl || '');
                payload.append('signature_type', signatureMeta.signatureType || 'optional');
                payload.append('signature_capture_method', signatureMeta.captureMethod || 'drawn');
                if (signatureMeta.signatureType === 'pnpki') {
                    payload.append('pnpki_expiration_date', signatureMeta.expirationDate || '');
                    if (signatureMeta.pnpkiProofFile) {
                        payload.append('pnpki_proof_pdf', signatureMeta.pnpkiProofFile);
                    }
                }
                if (authorizationLetter) {
                    payload.append('authorization_letter', authorizationLetter);
                }
                payload.append('accessible_systems', JSON.stringify(selectedSystems));
                payload.append('cf_turnstile_response', registerTurnstileToken);
                if (selectedRoles.includes('twg')) {
                    payload.append('account_code_ids', JSON.stringify(selectedAccountCodeIds));
                }
            } else {
                payload = {
                    ...registerData,
                    role: selectedRoles[0] || '',
                    roles: selectedRoles,
                    signature: finalSigUrl,
                    signature_type: signatureMeta.signatureType || 'optional',
                    signature_capture_method: signatureMeta.captureMethod || 'drawn',
                    pnpki_expiration_date: signatureMeta.signatureType === 'pnpki' ? signatureMeta.expirationDate : null,
                    accessible_systems: selectedSystems,
                    account_code_ids: selectedRoles.includes('twg') ? selectedAccountCodeIds : [],
                    cf_turnstile_response: registerTurnstileToken,
                };
            }

            await authService.register(payload);

            setMode('login');
            setEmail(registerData.email);
            setPassword('');

            setRegisterData({
                name: '',
                email: '',
                role: '',
                phone_number: '',
                address: '',
                office_id: '',
                designation: '',
                password: '',
                password_confirmation: '',
            });
            setSelectedRoles([]);
            setSelectedAccountCodeIds([]);
            setSelectedSystems([]);
            setAuthorizationLetter(null);
            setAuthorizationLetterError('');
            if (authLetterInputRef.current) authLetterInputRef.current.value = '';
            clearSignature();
            setRegisterTurnstileReset((prev) => prev + 1);

            setShowPendingModal(true);
        } catch (err) {
            setRegisterTurnstileReset((prev) => prev + 1);
            if (err.response?.data?.errors) {
                const firstKey = Object.keys(err.response.data.errors)[0];
                setError(err.response.data.errors[firstKey][0]);
            } else {
                setError(err.response?.data?.message || 'Registration failed. Please check your information.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col-reverse lg:flex-row bg-slate-950 text-slate-800 antialiased overflow-x-hidden">

            <div className="w-full lg:w-[52%] xl:w-[55%] 2xl:w-[58%] relative flex flex-col justify-between overflow-hidden bg-blue-950 border-t lg:border-t-0 lg:border-r border-blue-900/40 lg:h-screen lg:max-h-screen">

                <div
                    className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
                    style={{
                        backgroundImage: `url('/images/bg.jpg')`,
                    }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-950/80 via-sky-900/40 to-transparent" />

                <SpiderParticlesCanvas className="absolute inset-0 pointer-events-none z-0 opacity-75" />

                <div className="absolute -bottom-16 -left-16 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-10 right-10 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

                <div className="landing-fade-top relative z-10 px-4 sm:px-6 xl:px-8 py-3 flex items-center justify-between gap-2 flex-nowrap">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/70 backdrop-blur-xl border border-white/20 text-white shadow-md whitespace-nowrap shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="text-[9.5px] xl:text-[10px] font-bold tracking-wider uppercase text-blue-100">OPPMO - BAC</span>
                        </div>
                        <div className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 text-amber-200 text-[9px] xl:text-[9.5px] font-bold tracking-wider uppercase shadow-sm font-mono whitespace-nowrap shrink-0">
                            <span>MULTI-SYSTEM GATEWAY</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0 ml-auto">
                        <div className="text-right hidden sm:block min-w-0">
                            <p className="text-[10px] xl:text-[11px] 2xl:text-xs font-extrabold text-white uppercase tracking-wide leading-tight drop-shadow-md truncate">
                                Office of the Provincial Procurement Management Officer
                            </p>
                            <p className="text-[9px] xl:text-[10px] text-amber-300 font-semibold tracking-wide uppercase leading-tight mt-0.5 drop-shadow-sm truncate">
                                (OPPMO) • Bids and Awards Committee
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <img
                                src="/images/logo.png"
                                alt="Davao del Sur Official Seal"
                                className="w-7 h-7 xl:w-8 xl:h-8 object-contain drop-shadow-lg"
                            />
                            <img
                                src="/images/pmo.jpeg"
                                alt="OPPMO Seal"
                                className="w-7 h-7 xl:w-8 xl:h-8 object-contain rounded-full border border-white/30 shadow-md drop-shadow-lg"
                            />
                        </div>
                    </div>
                </div>

                <div className="relative z-10 px-4 sm:px-6 xl:px-10 py-5 sm:py-6 lg:py-4 max-w-4xl my-auto w-full">
                    <div className="landing-hero-title inline-flex items-center gap-2 px-3 py-1 bg-amber-500/25 border border-amber-300/40 rounded-lg text-amber-200 text-[10px] sm:text-[11px] xl:text-xs font-mono font-bold tracking-wider uppercase mb-2 backdrop-blur-md shadow-sm soft-glow-badge">
                        <span>Province of Davao Del Sur • Unified Digital Gateway</span>
                    </div>

                    <h2 className="landing-hero-title text-xl sm:text-2xl xl:text-3xl 2xl:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-[0_2px_12px_rgba(15,23,42,0.8)]">
                        Provincial Multi-System Procurement Portal
                    </h2>

                    <p className="landing-hero-sub mt-1.5 sm:mt-2 text-xs xl:text-sm text-blue-50/95 leading-relaxed font-normal drop-shadow max-w-2xl">
                        Centralized single sign-on authentication and unified governance across Davao del Sur's digital procurement infrastructure, automated PPMP/APP workflows, real-time project implementation monitoring, and provincial supplier evaluations.
                    </p>

                    <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-400/35 text-blue-200 text-[10.5px] sm:text-[11px] font-semibold backdrop-blur-md shadow-sm">
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Unified SSO Credentials • One Account for All Integrated Systems</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3 xl:gap-4 mt-4 xl:mt-5 perspective-[1000px] w-full">

                        <div className="intro-card-1 relative p-3 sm:p-4 xl:p-5 rounded-2xl bg-gradient-to-b from-blue-950/85 via-slate-900/85 to-slate-950/90 backdrop-blur-xl border border-amber-400/35 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/25 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-400/15 rounded-full blur-xl group-hover:bg-amber-400/30 transition-colors pointer-events-none" />

                            <div>
                                <div className="flex items-center justify-between gap-1.5 mb-2">
                                    <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-600/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                        <FileCheck2 className="w-4 h-4 xl:w-5 xl:h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9.5px] xl:text-[10px] font-mono font-bold uppercase tracking-wider">
                                        PRIMARY PORTAL
                                    </span>
                                </div>

                                <h4 className="text-xs sm:text-sm xl:text-base font-black text-white uppercase tracking-wider mb-1 group-hover:text-amber-200 transition-colors">
                                    PPMP &amp; APP System
                                </h4>
                                <p className="text-[11px] xl:text-xs text-blue-100/90 leading-snug">
                                    Automated PPMP creation, multi-tier approvals, specimen digital signatures, and APP consolidation.
                                </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-white/10 text-[9.5px] xl:text-[10px] font-semibold text-amber-300/80 flex items-center justify-between">
                                <span>RA 12009 / RA 9184 Standard</span>
                                <ArrowRight className="w-3 h-3 text-amber-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>

                        <div className="intro-card-2 relative p-3 sm:p-4 xl:p-5 rounded-2xl bg-gradient-to-b from-blue-950/85 via-slate-900/85 to-slate-950/90 backdrop-blur-xl border border-sky-400/35 hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-500/25 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-sky-400/15 rounded-full blur-xl group-hover:bg-sky-400/30 transition-colors pointer-events-none" />

                            <div>
                                <div className="flex items-center justify-between gap-1.5 mb-2">
                                    <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-sky-400/30 to-blue-600/20 border border-sky-300/40 flex items-center justify-center text-sky-200 shadow-sm group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                                        <ShieldCheck className="w-4 h-4 xl:w-5 xl:h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[9.5px] xl:text-[10px] font-mono font-bold uppercase tracking-wider">
                                        LIVE PIMS TRACKING
                                    </span>
                                </div>

                                <h4 className="text-xs sm:text-sm xl:text-base font-black text-white uppercase tracking-wider mb-1 group-hover:text-sky-200 transition-colors">
                                    Real-Time Monitoring
                                </h4>
                                <p className="text-[11px] xl:text-xs text-blue-100/90 leading-snug">
                                    Milestone stage surveillance across offices, implementation timelines, and automated PIMS publishing.
                                </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-white/10 text-[9.5px] xl:text-[10px] font-semibold text-sky-300/80 flex items-center justify-between">
                                <span>End-to-End Surveillance</span>
                                <ArrowRight className="w-3 h-3 text-sky-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>

                        <div className="intro-card-3 relative p-3 sm:p-4 xl:p-5 rounded-2xl bg-gradient-to-b from-blue-950/85 via-slate-900/85 to-slate-950/90 backdrop-blur-xl border border-emerald-400/35 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/25 hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-400/15 rounded-full blur-xl group-hover:bg-emerald-400/30 transition-colors pointer-events-none" />

                            <div>
                                <div className="flex items-center justify-between gap-1.5 mb-2">
                                    <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-emerald-400/30 to-teal-600/20 border border-emerald-300/40 flex items-center justify-center text-emerald-200 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                        <Award className="w-4 h-4 xl:w-5 xl:h-5" />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9.5px] xl:text-[10px] font-mono font-bold uppercase tracking-wider">
                                        VENDOR APPRAISAL
                                    </span>
                                </div>

                                <h4 className="text-xs sm:text-sm xl:text-base font-black text-white uppercase tracking-wider mb-1 group-hover:text-emerald-200 transition-colors">
                                    Supplier Evaluation
                                </h4>
                                <p className="text-[11px] xl:text-xs text-blue-100/90 leading-snug">
                                    Comprehensive vendor ratings, 4-tier criteria performance scoring, and official supplier compliance logs.
                                </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-white/10 text-[9.5px] xl:text-[10px] font-semibold text-emerald-300/80 flex items-center justify-between">
                                <span>4-Tier Criteria Scoring</span>
                                <ArrowRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 px-4 sm:px-6 xl:px-8 py-2.5 xl:py-3 border-t border-white/15 bg-blue-950/60 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 text-[10.5px] xl:text-[11px] text-blue-100">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-blue-100 font-medium"></span>
                    </div>
                    <div className="text-blue-200/80 text-[10px] xl:text-[10.5px] font-mono">
                        ISO 9001:2015 CERTIFIED • PROVINCE OF DAVAO DEL SUR
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-[48%] xl:w-[45%] 2xl:w-[42%] lg:h-screen flex flex-col bg-slate-50/95 relative z-20 shadow-2xl lg:overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-l border-slate-200/80">

                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-blue-600 to-indigo-600" />

                <div className={`w-full max-w-xl mx-auto px-3.5 sm:px-6 lg:px-6 xl:px-8 py-5 sm:py-7 flex-1 flex flex-col ${mode === 'login' ? 'justify-center' : 'justify-start'}`}>

                    <div className={`landing-auth-card bg-white rounded-2xl p-4 sm:p-6 lg:p-6 xl:p-7 shadow-lg shadow-slate-200/50 border border-slate-200/80 w-full ${mode === 'login' ? 'my-auto' : ''}`}>

                        {onBackToLanding && (
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition mb-3 hover:underline"
                            >
                                <span>← Back to Portal Home</span>
                            </button>
                        )}

                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-2.5">
                                <div className="w-10 h-10 rounded-xl p-1 bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                                    <img
                                        src="/images/logo.png"
                                        alt="Province of Davao del Sur Seal"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="w-10 h-10 rounded-xl p-1 bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                                    <img
                                        src="/images/pmo.jpeg"
                                        alt="BAC PMO Seal"
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                </div>
                                <div className="border-l border-slate-200 pl-3.5">
                                    <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight uppercase font-sans">
                                        Provincial Government
                                    </h1>
                                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest leading-none mt-0.5">
                                        Davao del Sur
                                    </p>
                                    <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mt-1">
                                        ISO 9001:2015 CERTIFIED
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    {mode === 'login' ? 'Unified Portal Access' : 'Create Government Account'}
                                </h2>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                                    {mode === 'login'
                                        ? 'Sign in with your provincial credentials to access your authorized digital systems and procurement workspaces.'
                                        : 'Fill in your provincial credentials to register for workspace authorization.'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200/80 shadow-inner">
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('login');
                                    setError('');
                                    setSuccessMsg('');
                                }}
                                className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
                                    mode === 'login'
                                        ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200/60'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (mode !== 'register') {
                                        setShowPrivacyNotice(true);
                                    }
                                }}
                                className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
                                    mode === 'register'
                                        ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200/60'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Create Account
                            </button>
                        </div>

                        {error && (
                            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200/80 text-rose-700 text-xs rounded-xl flex items-start gap-2.5 animate-fade-in-up">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                                <span className="font-semibold leading-relaxed">{error}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs rounded-xl flex items-start gap-2.5 animate-fade-in-up">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                                <span className="font-semibold leading-relaxed">{successMsg}</span>
                            </div>
                        )}

                        {mode === 'login' ? (
                            <div className="animate-fade-in-up">
                                <form className="space-y-3" onSubmit={handleLogin}>
                                    <div>
                                        <label
                                            htmlFor="login-email"
                                            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                                        >
                                            Official Email Address
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            </div>
                                            <input
                                                id="login-email"
                                                name="email"
                                                type="email"
                                                autoComplete="username"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="user@example.com"
                                                className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label
                                                htmlFor="login-password"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider"
                                            >
                                                Account Password
                                            </label>
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            </div>
                                            <input
                                                id="login-password"
                                                name="password"
                                                type={showLoginPassword ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition"
                                                title={showLoginPassword ? 'Hide password' : 'Show password'}
                                                tabIndex={-1}
                                            >
                                                {showLoginPassword ? (
                                                    <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-700" />
                                                ) : (
                                                    <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {turnstileEnabled && (
                                        <CloudflareSecurityVerification
                                            actionLabel="sign in"
                                            onVerify={setLoginTurnstileToken}
                                            resetTrigger={loginTurnstileReset}
                                        />
                                    )}

                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            disabled={loading || lockoutSeconds > 0 || (turnstileEnabled && !loginTurnstileToken)}
                                            className={`w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-bold uppercase tracking-wider text-white transition-all transform active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                lockoutSeconds > 0
                                                    ? 'bg-rose-600 hover:bg-rose-700 cursor-not-allowed opacity-90'
                                                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20 focus:ring-slate-900 disabled:opacity-50'
                                            }`}
                                        >
                                            {lockoutSeconds > 0 ? (
                                                <>
                                                    <Lock className="w-4 h-4 animate-pulse" />
                                                    Locked Out: Wait {lockoutSeconds}s
                                                </>
                                            ) : loading ? (
                                                <>
                                                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                    Authenticating...
                                                </>
                                            ) : (
                                                <>
                                                    Sign In to Workspace
                                                    <ArrowRight className="w-4 h-4 text-amber-400" />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-center gap-2 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onOpenPrivacy) {
                                                    onOpenPrivacy();
                                                } else {
                                                    window.location.href = '/privacy';
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-blue-600 transition hover:underline cursor-pointer pt-1"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Data Privacy Policy (RA 10173)</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (

                            <div className="animate-fade-in-up">
                                <form className="space-y-2.5" onSubmit={handleRegister}>
                                    <div>
                                        <label
                                            htmlFor="register-name"
                                            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                        >
                                            Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <UserIcon className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            </div>
                                            <input
                                                id="register-name"
                                                name="name"
                                                type="text"
                                                autoComplete="name"
                                                required
                                                value={registerData.name}
                                                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                                placeholder="e.g. Juan Dela Cruz"
                                                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label
                                                htmlFor="register-email"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                Email Address <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <input
                                                    id="register-email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={registerData.email}
                                                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                    placeholder="user@davaodelsur.gov.ph"
                                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="register-phone"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                Phone Number <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Phone className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <input
                                                    id="register-phone"
                                                    name="phone_number"
                                                    type="tel"
                                                    autoComplete="tel"
                                                    required
                                                    value={registerData.phone_number}
                                                    onChange={(e) => setRegisterData({ ...registerData, phone_number: e.target.value })}
                                                    placeholder="0912 345 6789"
                                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="register-address"
                                            className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                        >
                                            User Address <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <MapPin className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            </div>
                                            <input
                                                id="register-address"
                                                name="address"
                                                type="text"
                                                autoComplete="street-address"
                                                required
                                                value={registerData.address}
                                                onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                                                placeholder="e.g. Digos City, Davao del Sur"
                                                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="relative" ref={officeDropdownRef}>
                                        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Assigned Office / Department <span className="text-rose-500">*</span>
                                        </span>

                                        <input
                                            type="hidden"
                                            name="office_id"
                                            value={registerData.office_id}
                                        />

                                        <div
                                            id="register-office-select-btn"
                                            role="combobox"
                                            tabIndex={0}
                                            aria-label="Assigned Office / Department"
                                            aria-expanded={isOfficeDropdownOpen}
                                            aria-haspopup="listbox"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIsOfficeDropdownOpen(!isOfficeDropdownOpen);
                                                }
                                            }}
                                            onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                                            className={`w-full min-h-[42px] px-3 py-2 border rounded-xl flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-white transition shadow-sm text-left ${
                                                isOfficeDropdownOpen
                                                    ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white'
                                                    : 'border-slate-300 hover:border-slate-400'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate mr-2">
                                                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                                                {selectedOffice ? (
                                                    <div className="truncate text-xs font-semibold text-slate-800">
                                                        {selectedOffice.code && (
                                                            <span className="inline-block px-1.5 py-0.5 mr-1.5 bg-blue-50 text-blue-700 font-mono text-[10px] rounded border border-blue-200">
                                                                {selectedOffice.code}
                                                            </span>
                                                        )}
                                                        <span>{selectedOffice.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">
                                                        {loadingOffices ? 'Loading offices...' : '-- Select Office / Department --'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {selectedOffice && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearOffice}
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                                                        title="Clear selection"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {isOfficeDropdownOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                                        <input
                                                            id="register-office-search"
                                                            name="office_search"
                                                            type="text"
                                                            autoFocus
                                                            aria-label="Search office by code or name"
                                                            value={officeSearchTerm}
                                                            onChange={(e) => setOfficeSearchTerm(e.target.value)}
                                                            placeholder="Search by code or office name..."
                                                            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                                                    {filteredOffices.length > 0 ? (
                                                        filteredOffices.map((off) => {
                                                            const isSelected = String(off.id) === String(registerData.office_id);
                                                            return (
                                                                <div
                                                                    key={off.id}
                                                                    onClick={() => handleSelectOffice(off)}
                                                                    className={`p-2.5 text-xs cursor-pointer flex items-start justify-between transition ${
                                                                        isSelected
                                                                            ? 'bg-blue-50 text-blue-900 font-semibold'
                                                                            : 'hover:bg-slate-50 text-slate-700'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 pr-2">
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            {off.code && (
                                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded font-semibold border border-slate-200">
                                                                                    {off.code}
                                                                                </span>
                                                                            )}
                                                                            <span className="truncate font-medium">{off.name}</span>
                                                                        </div>
                                                                        {off.head_name && (
                                                                            <div className="text-[10px] text-slate-400 font-normal">
                                                                                Head: {off.head_name} {off.designation ? `(${off.designation})` : ''}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {isSelected && (
                                                                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            No offices match "{officeSearchTerm}"
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-medium text-right">
                                                    Showing {filteredOffices.length} of {offices.length} offices
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative" ref={systemsDropdownRef}>
                                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Requested Digital Systems Access <span className="text-rose-500">*</span>
                                            </label>
                                            {selectedSystems.length > 0 ? (
                                                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap shrink-0">
                                                    {selectedSystems.length} {selectedSystems.length === 1 ? 'system' : 'systems'} selected
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0">
                                                    0 systems selected
                                                </span>
                                            )}
                                        </div>

                                        <div
                                            id="register-systems-select-btn"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setIsSystemsDropdownOpen(!isSystemsDropdownOpen)}
                                            className={`w-full min-h-[42px] px-3 py-2 border rounded-xl flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-white transition shadow-sm text-left ${
                                                isSystemsDropdownOpen
                                                    ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white'
                                                    : 'border-slate-300 hover:border-slate-400'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate mr-2">
                                                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                                                {selectedSystems.length > 0 ? (
                                                    <div className="truncate text-xs font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                        {selectedSystems.map((url) => {
                                                            const matched = availableSystems.find((s) => s.link_url === url);
                                                            const label = matched?.name || (url === '/monitoringsystem' ? 'Monitoring System' : url === '/pims' ? 'PIMS System' : url === '/supplierevaluation' ? 'Supplier Evaluation' : 'PPMP & APP System');
                                                            return (
                                                                <span
                                                                    key={url}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200"
                                                                >
                                                                    <Check className="w-3 h-3 text-blue-600" />
                                                                    <span className="max-w-[130px] truncate">{label}</span>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-normal">
                                                        Please select system access...
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isSystemsDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {isSystemsDropdownOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-2.5">
                                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[11px]">
                                                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                                                        Available Provincial Systems
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSystems(availableSystems.map((s) => s.link_url))}
                                                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                                        >
                                                            Select All
                                                        </button>
                                                        <span className="text-slate-300">•</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSystems([])}
                                                            className="text-slate-500 hover:text-slate-700 font-medium hover:underline cursor-pointer"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                                    {loadingSystems ? (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            Loading available systems...
                                                        </div>
                                                    ) : availableSystems.length === 0 ? (
                                                        <div className="p-4 text-center text-xs text-slate-400">
                                                            No active digital systems available.
                                                        </div>
                                                    ) : availableSystems.map((sys) => {
                                                        const isChecked = selectedSystems.includes(sys.link_url);
                                                        return (
                                                            <label
                                                                key={sys.id || sys.link_url}
                                                                className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                                                                    isChecked
                                                                        ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                                                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedSystems(prev => [...prev, sys.link_url]);
                                                                        } else {
                                                                            setSelectedSystems(prev => prev.filter(u => u !== sys.link_url));
                                                                        }
                                                                    }}
                                                                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-xs font-bold text-slate-900 leading-snug">
                                                                            {sys.name}
                                                                        </span>
                                                                        {sys.badge && (
                                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                                                {sys.badge}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                        URL: <span className="text-blue-600 font-semibold">{sys.link_url}</span>
                                                                    </div>
                                                                    {sys.description && (
                                                                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                                                            {sys.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                                    <span>Select all systems required for your duties.</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSystemsDropdownOpen(false)}
                                                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                                                    >
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        <div ref={rolesDropdownRef} className="relative">
                                            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                                                <label
                                                    htmlFor="register-role-btn"
                                                    className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider"
                                                >
                                                    System Role(s) <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                                                    {selectedRoles.length} {selectedRoles.length === 1 ? 'role' : 'roles'} selected
                                                </span>
                                            </div>
                                            <button
                                                id="register-role-btn"
                                                type="button"
                                                onClick={() => setIsRolesDropdownOpen((prev) => !prev)}
                                                className={`w-full text-xs pl-9 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium text-left relative cursor-pointer truncate ${
                                                    isRolesDropdownOpen ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white' : 'border-slate-300'
                                                } ${selectedRoles.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}
                                            >
                                                <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <span className="block truncate">
                                                    {selectedRoles.length === 0
                                                        ? 'Select one or more system roles...'
                                                        : selectedRoles.map((r) => getRoleInfo(r).shortLabel).join(', ')}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${isRolesDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                                            </button>

                                            {selectedRoles.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {selectedRoles.map((r) => (
                                                        <span
                                                            key={r}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold"
                                                        >
                                                            {getRoleInfo(r).shortLabel}
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRegisterRole(r)}
                                                                className="hover:text-rose-600 cursor-pointer"
                                                                title={`Remove ${getRoleInfo(r).label}`}
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {isRolesDropdownOpen && (
                                                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-50 p-1.5 space-y-0.5">
                                                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        Check all roles that apply to this account
                                                    </div>
                                                    {REGISTRATION_ROLE_OPTIONS.map((opt) => {
                                                        const checked = selectedRoles.includes(opt.value);
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => toggleRegisterRole(opt.value)}
                                                                className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                                                                    checked
                                                                        ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                                                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
                                                                        checked
                                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                                            : 'bg-white border-slate-300'
                                                                    }`}
                                                                >
                                                                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                                                                </span>
                                                                <span className="min-w-0">
                                                                    <span className="block text-xs font-bold leading-tight">{opt.label}</span>
                                                                    <span className="block text-[10px] text-slate-500 leading-snug mt-0.5">{opt.desc}</span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="register-designation"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                Position / Designation <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Briefcase className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <input
                                                    id="register-designation"
                                                    name="designation"
                                                    type="text"
                                                    required
                                                    value={registerData.designation}
                                                    onChange={(e) => setRegisterData({ ...registerData, designation: e.target.value })}
                                                    placeholder="e.g. Admin Officer IV"
                                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label
                                                htmlFor="register-password"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                Password <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <input
                                                    id="register-password"
                                                    name="password"
                                                    type={showRegisterPassword ? 'text' : 'password'}
                                                    autoComplete="new-password"
                                                    required
                                                    minLength={6}
                                                    value={registerData.password}
                                                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                                    placeholder="Min. 6 characters"
                                                    className="w-full text-xs pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition"
                                                    title={showRegisterPassword ? 'Hide password' : 'Show password'}
                                                    tabIndex={-1}
                                                >
                                                    {showRegisterPassword ? (
                                                        <EyeOff className="w-3.5 h-3.5 text-slate-500 hover:text-slate-700" />
                                                    ) : (
                                                        <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label
                                                htmlFor="register-password-confirmation"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                Confirm <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <input
                                                    id="register-password-confirmation"
                                                    name="password_confirmation"
                                                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                                                    autoComplete="new-password"
                                                    required
                                                    minLength={6}
                                                    value={registerData.password_confirmation}
                                                    onChange={(e) => setRegisterData({ ...registerData, password_confirmation: e.target.value })}
                                                    placeholder="Repeat password"
                                                    className="w-full text-xs pl-9 pr-9 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition"
                                                    title={showRegisterConfirmPassword ? 'Hide password' : 'Show password'}
                                                    tabIndex={-1}
                                                >
                                                    {showRegisterConfirmPassword ? (
                                                        <EyeOff className="w-3.5 h-3.5 text-slate-500 hover:text-slate-700" />
                                                    ) : (
                                                        <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedRoles.includes('authorized_staff') && (
                                        <div className="p-3.5 bg-blue-50/70 border-2 border-blue-300 rounded-xl space-y-2.5 shadow-sm animate-fade-in-up">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                                                    <span className="block text-[11px] font-bold text-blue-950 uppercase tracking-wider">
                                                        Authorization Letter (PDF) <span className="text-rose-500">*</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full flex items-center gap-1">
                                                        <Lock className="w-2.5 h-2.5" /> PDF Only &bull; Max 5MB
                                                    </span>
                                                    {authorizationLetter && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAuthorizationLetter(null);
                                                                setAuthorizationLetterError('');
                                                                if (authLetterInputRef.current) authLetterInputRef.current.value = '';
                                                            }}
                                                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition px-1"
                                                        >
                                                            <Eraser className="w-3 h-3" />
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-[11px] text-blue-900 leading-relaxed font-medium">
                                                As an Authorize Staff acting on behalf of the Office Head, you must attach the signed <strong>Official Authorization Letter (PDF)</strong>.
                                            </p>

                                            <input
                                                ref={authLetterInputRef}
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                className="hidden"
                                                id="authorization-letter-file-input"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    validateAndSetAuthorizationLetter(file, e.target);
                                                }}
                                            />

                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => authLetterInputRef.current?.click()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        authLetterInputRef.current?.click();
                                                    }
                                                }}
                                                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition select-none ${
                                                    authorizationLetter
                                                        ? 'border-emerald-400 bg-emerald-50/60 hover:bg-emerald-50'
                                                        : authorizationLetterError
                                                            ? 'border-rose-300 hover:border-rose-400 bg-rose-50/30'
                                                            : 'border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50/40'
                                                }`}
                                            >
                                                {authorizationLetter ? (
                                                    <div className="flex items-center gap-3 w-full">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                                                            <FileCheck2 className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 text-left">
                                                            <div className="text-xs font-bold text-slate-900 truncate">
                                                                Validated PDF: {authorizationLetter.name}
                                                            </div>
                                                            <div className="text-[10px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                                                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                                <span>{(authorizationLetter.size / 1024 / 1024).toFixed(2)} MB &bull; Digital header verified (%PDF-)</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[11px] font-bold text-blue-600 hover:underline shrink-0">
                                                            Change
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-center">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100/80 text-blue-700 flex items-center justify-center mb-1.5 shadow-2xs">
                                                            <FileUp className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-xs font-bold text-blue-900">
                                                            Click here to attach Authorization Letter (PDF)
                                                        </span>
                                                        <span className="text-[10px] text-blue-700/80 mt-0.5">
                                                            Strictly genuine PDF format up to 5MB &bull; Saved to secure private storage
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-2 bg-white/90 border border-blue-200 rounded-lg text-[10px] text-slate-600 flex items-start gap-1.5">
                                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.2" />
                                                <span>
                                                    <strong>Security Protection:</strong> Authorization letters are verified against genuine PDF header signatures (%PDF-), checked for executable macros, and stored in secure private government storage.
                                                </span>
                                            </div>

                                            {authorizationLetterError && (
                                                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    {authorizationLetterError}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {selectedRoles.includes('twg') && (
                                        <div className="p-3.5 bg-amber-50/70 border-2 border-amber-300 rounded-xl space-y-2.5 shadow-sm animate-fade-in-up">
                                            <AccountCodeMultiSelect
                                                selectedIds={selectedAccountCodeIds}
                                                onChange={setSelectedAccountCodeIds}
                                                isPublic={true}
                                                label="Assigned Account Codes (TWG Scope)"
                                            />
                                        </div>
                                    )}

                                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <PenTool className="w-3.5 h-3.5 text-blue-600" />
                                                <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Specimen Official Signature <span className="text-rose-500">*</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSignatureModalOpen(true)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition shadow-xs active:scale-95"
                                                >
                                                    <Maximize2 className="w-3 h-3" />
                                                    {hasSignature ? 'Edit Signature' : 'Draw Freely'}
                                                </button>
                                                {hasSignature && (
                                                    <button
                                                        type="button"
                                                        onClick={clearSignature}
                                                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition px-1"
                                                        title="Remove signature"
                                                    >
                                                        <Eraser className="w-3 h-3" />
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setIsSignatureModalOpen(true)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setIsSignatureModalOpen(true);
                                                }
                                            }}
                                            className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white overflow-hidden shadow-inner group transition-all duration-200 cursor-pointer h-[110px] flex items-center justify-center select-none"
                                        >
                                            {hasSignature && signatureDataUrl ? (
                                                <div className="w-full h-full p-2 flex flex-col items-center justify-center relative group-hover:bg-blue-50/30 transition">
                                                    <img
                                                        src={signatureDataUrl}
                                                        alt="Captured specimen signature"
                                                        className="max-h-full max-w-full object-contain filter contrast-125 drop-shadow-sm"
                                                    />
                                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[0.5px]">
                                                        <span className="px-3 py-1 bg-white/90 text-slate-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1">
                                                            <PenTool className="w-3 h-3 text-blue-600" /> Click to Redraw / Edit
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 p-4 transition-colors text-center">
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-1.5 transition-colors shadow-xs group-hover:scale-105">
                                                        <PenTool className="w-5 h-5 stroke-[1.75]" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                                                        Click here to open Signature Studio
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 mt-0.5">
                                                        Draw freely with smooth curves on desktop, mobile, or stylus
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                                            <span>Encrypted private specimen for procurement validation.</span>
                                            {hasSignature ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                        <Check className="w-3 h-3" />
                                                        {signatureMeta.signatureType === 'pnpki'
                                                            ? 'PNPKI E-Sig Captured'
                                                            : 'Optional E-Sig Captured'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSignatureModalOpen(true)}
                                                        className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer ml-1"
                                                    >
                                                        Modify
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-rose-500 font-semibold flex items-center gap-1">
                                                    * Required for account approval
                                                </span>
                                            )}
                                        </div>

                                        {hasSignature && (
                                            <div
                                                className={`p-2.5 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                                                    signatureMeta.signatureType === 'pnpki'
                                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                                        : 'bg-blue-50/70 border-blue-200 text-blue-900'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    {signatureMeta.signatureType === 'pnpki' ? (
                                                        <>
                                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                            <span>PNPKI Digital E-Signature</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PenTool className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                            <span>Optional Digital Signature</span>
                                                        </>
                                                    )}
                                                </div>
                                                {signatureMeta.signatureType === 'pnpki' ? (
                                                    <div className="flex items-center gap-2 text-[10px] font-semibold text-emerald-800 flex-wrap">
                                                        <span className="px-1.5 py-0.5 rounded bg-white border border-emerald-200">
                                                            Expires: {signatureMeta.expirationDate}
                                                        </span>
                                                        {signatureMeta.pnpkiProofFile && (
                                                            <span className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 truncate max-w-[160px]" title={signatureMeta.pnpkiProofFile.name}>
                                                                PDF: {signatureMeta.pnpkiProofFile.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-medium text-blue-700">
                                                        {signatureMeta.captureMethod === 'uploaded' ? 'Attached Image' : 'Freeform Drawn'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {turnstileEnabled && (
                                        <CloudflareSecurityVerification
                                            actionLabel="register"
                                            onVerify={setRegisterTurnstileToken}
                                            resetTrigger={registerTurnstileReset}
                                        />
                                    )}

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading || (turnstileEnabled && !registerTurnstileToken)}
                                            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 shadow-slate-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all transform active:scale-[0.99] disabled:opacity-50"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                                    Creating Account...
                                                </>
                                            ) : (
                                                <>
                                                    Complete Registration
                                                    <ArrowRight className="w-4 h-4 text-amber-400" />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-center gap-2 pt-3">
                                        <div className="text-xs text-slate-500">
                                            Already registered?{' '}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMode('login');
                                                    setError('');
                                                }}
                                                className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                                            >
                                                Sign In here
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onOpenPrivacy) {
                                                    onOpenPrivacy();
                                                } else {
                                                    window.location.href = '/privacy';
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-blue-600 transition hover:underline cursor-pointer pt-1"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Data Privacy Policy (RA 10173)</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full px-6 sm:px-10 py-4 border-t border-slate-200/60 bg-white/70 flex items-center justify-between text-[11px] text-slate-400">
                    <span>© {new Date().getFullYear()} Province of Davao del Sur</span>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-slate-200">
                        v2.5 Enterprise
                    </span>
                </div>
            </div>

            {showPrivacyNotice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

                        <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300">
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                        Data Privacy Notice & Consent
                                    </h3>
                                    <p className="text-[11px] text-blue-300 font-medium">
                                        Republic Act No. 10173 (Data Privacy Act of 2012)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPrivacyNotice(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-white/10 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed custom-scrollbar">
                            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 font-medium leading-relaxed">
                                The <strong className="text-blue-950">Provincial Government of Davao del Sur</strong> is committed to protecting and respecting your personal data privacy in compliance with Republic Act No. 10173, also known as the <em>Data Privacy Act of 2012</em>.
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    Information Collected Upon Registration
                                </h4>
                                <p className="mb-2 text-slate-600">
                                    To create your authorized account in this Integrated E-Procurement PPMP/APP System, we collect the following personal and official information:
                                </p>
                                <ul className="space-y-1.5 list-disc pl-5 text-slate-700 font-medium">
                                    <li><strong>Full Name:</strong> Required for official identity, review tracking, and accountability.</li>
                                    <li><strong>Official Email Address:</strong> Used for account credentials, system notifications, and security recovery.</li>
                                    <li><strong>Contact / Phone Number:</strong> Used for official procurement communications and verification.</li>
                                    <li><strong>User Address:</strong> Used for user account identification, profile verification, and record integrity.</li>
                                    <li><strong>Department / Implementing Office & Designation:</strong> Identifies your administrative unit and procurement jurisdiction.</li>
                                    <li><strong>System Role / Privilege Level:</strong> Determines access control for procurement operations.</li>
                                    <li><strong>Specimen Digital Signature:</strong> Affixed to official PPMP documents for electronic endorsements and reviews.</li>
                                </ul>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1.5">
                                    Purpose of Data Processing
                                </h4>
                                <p className="text-slate-600">
                                    Your information will be used exclusively for:
                                </p>
                                <ul className="mt-1 space-y-1 list-disc pl-5 text-slate-600">
                                    <li>Authenticating and authorizing access to the provincial procurement workspace.</li>
                                    <li>Generating and processing official Project Procurement Management Plans (PPMPs) and Annual Procurement Plans (APPs).</li>
                                    <li>Facilitating official document routing, audit trails, and multi-tier approval workflows.</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                                <strong>Declaration & Consent:</strong> By proceeding, you certify that all information submitted is true and correct, and you voluntarily consent to the collection, processing, and recording of your data for official provincial government procurement purposes.
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowPrivacyNotice(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                                >
                                    Decline & Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPrivacyNotice(false);
                                        setMode('register');
                                        setError('');
                                        setSuccessMsg('');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                                >
                                    <Check className="w-4 h-4" />
                                    I Understand & Agree to Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPendingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-7 border border-slate-200 text-center relative">
                        <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
                        </div>

                        <h3 className="text-base font-black text-slate-900 uppercase tracking-wide mb-3">
                            Account Pending Approval
                        </h3>

                        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-left mb-6">
                            <p className="text-xs text-amber-900 leading-relaxed font-medium">
                                Your account is pending approval. Your account will remain pending until you submit a User Access Form to the Office of the Provincial Procurement Management Officer for approval.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPendingModal(false)}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        >
                            Understood, Return to Sign In
                        </button>
                    </div>
                </div>
            )}

            {roleSelectionModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
                        <div className="bg-slate-900 text-white px-6 py-5 flex items-start justify-between gap-3">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Multi-Role Account Detected
                                </div>
                                <h3 className="text-base font-extrabold tracking-tight">
                                    Select Role Perspective
                                </h3>
                                <p className="text-xs text-slate-300 mt-1">
                                    Welcome back, <strong className="text-white">{roleSelectionModal.userPreview?.name || email}</strong>. Choose which role you want to log in as:
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={selectingRoleLoading}
                                onClick={() => setRoleSelectionModal(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                            {(roleSelectionModal.availableRoles || []).map((roleKey) => {
                                const info = getRoleInfo(roleKey);
                                const isSelected = chosenLoginRole === roleKey;
                                return (
                                    <button
                                        key={roleKey}
                                        type="button"
                                        disabled={selectingRoleLoading}
                                        onClick={() => setChosenLoginRole(roleKey)}
                                        onDoubleClick={() => handleConfirmRoleLogin(roleKey)}
                                        className={`w-full p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                                            isSelected
                                                ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                                                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-extrabold text-slate-900">
                                                    {info.label}
                                                </span>
                                                {isSelected && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                                                        <Check className="w-3 h-3" /> Selected
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                                                {info.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                disabled={selectingRoleLoading}
                                onClick={() => setRoleSelectionModal(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!chosenLoginRole || selectingRoleLoading}
                                onClick={() => handleConfirmRoleLogin(chosenLoginRole)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                            >
                                {selectingRoleLoading ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Signing In...
                                    </>
                                ) : (
                                    <>
                                        <span>Continue as {chosenLoginRole ? getRoleInfo(chosenLoginRole).shortLabel : 'Role'}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mfaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 px-5 py-4 text-white flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-tight uppercase">
                                        Super Admin MFA Verification
                                    </h3>
                                    <p className="text-[11px] text-blue-200 mt-0.5">
                                        Code sent to <span className="font-mono font-bold text-white">{mfaModal.maskedEmail}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeMfaModal}
                                disabled={mfaLoading}
                                className="p-1 text-slate-300 hover:text-white cursor-pointer"
                                aria-label="Close MFA modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleVerifyMfa} className="p-5 space-y-4">
                            {mfaInfo && !mfaError && (
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium leading-relaxed">
                                    {mfaInfo}
                                </div>
                            )}

                            {mfaError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                                    <span>{mfaError}</span>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label
                                        htmlFor="super-admin-mfa-digit-0"
                                        className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
                                    >
                                        6-Digit Verification Code
                                    </label>
                                    <span className={`text-[11px] font-mono font-bold ${mfaExpiresLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
                                        {mfaExpiresLeft > 0
                                            ? `Expires in ${Math.floor(mfaExpiresLeft / 60)}:${String(mfaExpiresLeft % 60).padStart(2, '0')}`
                                            : 'Code Expired'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-6 gap-2" onPaste={handleMfaPaste}>
                                    {mfaDigits.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={(el) => { mfaInputRefs.current[idx] = el; }}
                                            id={`super-admin-mfa-digit-${idx}`}
                                            name={`mfa_digit_${idx}`}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                                            maxLength={6}
                                            value={digit}
                                            disabled={mfaLoading || mfaExpiresLeft === 0}
                                            onChange={(e) => handleMfaDigitChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleMfaKeyDown(idx, e)}
                                            aria-label={`Verification code digit ${idx + 1}`}
                                            className="w-full h-12 text-center text-lg font-mono font-black text-slate-900 bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl focus:ring-2 focus:ring-blue-600/20 outline-none transition disabled:opacity-50"
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1">
                                <span className="text-slate-500">Didn&apos;t receive the email?</span>
                                <button
                                    type="button"
                                    onClick={handleResendMfa}
                                    disabled={mfaResending || mfaResendCooldown > 0 || mfaLoading}
                                    className="font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition"
                                >
                                    {mfaResending
                                        ? 'Sending...'
                                        : mfaResendCooldown > 0
                                            ? `Resend in ${mfaResendCooldown}s`
                                            : 'Resend Code'}
                                </button>
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeMfaModal}
                                    disabled={mfaLoading}
                                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={mfaLoading || mfaExpiresLeft === 0 || mfaDigits.join('').length !== 6}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                                >
                                    {mfaLoading ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Verify &amp; Enter Dashboard</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <SignaturePadModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleApplyModalSignature}
                initialDataUrl={signatureDataUrl}
                initialMeta={signatureMeta}
                title="Official Specimen Signature Studio"
                description="Sign freely inside this large high-resolution studio or attach an official e-signature image."
            />
        </div>
    );
};
