import React, { useState, useEffect, useRef } from 'react';
import { authService, portalSystemService } from '../../services/api';
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

export const LoginPage = ({ onLoginSuccess, onOpenPrivacy, onBackToLanding, initialError = '', targetSystem = 'dashboard' }) => {
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
    
    // Login state
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

    // Register state
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
    const [registerData, setRegisterData] = useState({
        name: '',
        email: '',
        role: 'end_user',
        phone_number: '',
        address: '',
        office_id: '',
        designation: '',
        password: '',
        password_confirmation: '',
    });
    const [authorizationLetter, setAuthorizationLetter] = useState(null);
    const [authorizationLetterError, setAuthorizationLetterError] = useState('');
    const authLetterInputRef = useRef(null);
    const [offices, setOffices] = useState([]);
    const [loadingOffices, setLoadingOffices] = useState(false);

    // Requested Digital Systems State (Multi-select)
    const [availableSystems, setAvailableSystems] = useState([
        { id: 1, name: 'E-Procurement PPMP & APP System', link_url: '/eprocrementppmpapp', badge: 'Primary System', description: 'Automated preparation, review lifecycle, and consolidation of PPMP and APP plans.' },
        { id: 2, name: 'OPPMO Real-Time Monitoring System', link_url: '/monitoringsystem', badge: 'Live Monitoring', description: 'Procurement implementation monitoring, milestone stage tracking, and PIMS timeline across provincial offices.' },
        { id: 3, name: 'Provincial Bids & Awards Portal', link_url: '/eprocrementppmpapp', badge: 'BAC Portal', description: 'Public bidding notices, awards, and procurement transparency documentation.' },
        { id: 4, name: 'Supplier Evaluation System', link_url: '/supplierevaluation', badge: 'Evaluations', description: 'Comprehensive supplier performance appraisal, criteria scoring, and vendor ratings.' },
    ]);
    const [selectedSystems, setSelectedSystems] = useState(() => {
        if (targetSystem === 'supplierevaluation') return ['/supplierevaluation'];
        if (targetSystem === 'monitoring') return ['/monitoringsystem'];
        return ['/eprocrementppmpapp'];
    });
    const [isSystemsDropdownOpen, setIsSystemsDropdownOpen] = useState(false);
    const systemsDropdownRef = useRef(null);

    useEffect(() => {
        if (targetSystem === 'supplierevaluation') {
            setSelectedSystems((prev) => prev.includes('/supplierevaluation') ? prev : ['/supplierevaluation']);
        } else if (targetSystem === 'monitoring') {
            setSelectedSystems((prev) => prev.includes('/monitoringsystem') ? prev : ['/monitoringsystem']);
        }
    }, [targetSystem]);

    // CAPTCHA State for Account Registration
    const [captchaCode, setCaptchaCode] = useState('');
    const [captchaInput, setCaptchaInput] = useState('');

    const generateCaptcha = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCaptchaCode(code);
        setCaptchaInput('');
    };

    useEffect(() => {
        generateCaptcha();
    }, []);

    // Draw Signature State for Account Registration (Modal-only Freeform Studio)
    const [hasSignature, setHasSignature] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [signatureDataUrl, setSignatureDataUrl] = useState(null);

    const clearSignature = (e) => {
        if (e) e.stopPropagation();
        setHasSignature(false);
        setSignatureDataUrl(null);
    };

    const handleApplyModalSignature = (dataUrl) => {
        if (dataUrl) {
            setSignatureDataUrl(dataUrl);
            setHasSignature(true);
        } else {
            clearSignature();
        }
    };

    // Searchable Office Dropdown State
    const [officeSearchTerm, setOfficeSearchTerm] = useState('');
    const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
    const officeDropdownRef = useRef(null);

    // Pending Approval Modal State
    const [showPendingModal, setShowPendingModal] = useState(false);

    // Fetch offices for registration dropdown
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
            try {
                const res = await portalSystemService.getPublic();
                if (res.data && res.data.length > 0) {
                    setAvailableSystems(res.data);
                }
            } catch (err) {
                console.warn('Using default systems on login/register', err);
            }
        };
        fetchSystems();
    }, []);

    // Close dropdown on outside click
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

    // Filter offices based on search term
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

    // Lockout countdown timer state (in seconds)
    const [lockoutSeconds, setLockoutSeconds] = useState(0);

    // Active countdown timer effect
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

        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await authService.login({ email, password });
            onLoginSuccess(res.data.user);
        } catch (err) {
            const serverMsg = err.response?.data?.message || 'Invalid credentials or inactive account.';
            setError(serverMsg);

            if (err.response?.status === 429 && err.response?.data?.retry_after) {
                setLockoutSeconds(err.response.data.retry_after);
            }
        } finally {
            setLoading(false);
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

        if (registerData.role === 'authorized_staff') {
            if (!authorizationLetter) {
                setError('Please attach the official Authorization Letter (PDF) signed by the Office Head.');
                return;
            }
            if (authorizationLetter.type !== 'application/pdf' && !authorizationLetter.name.toLowerCase().endsWith('.pdf')) {
                setError('Only PDF documents are accepted for the Authorization Letter.');
                return;
            }
        }

        if (!hasSignature || !signatureDataUrl) {
            setError('Please draw and capture your official specimen signature.');
            setIsSignatureModalOpen(true);
            return;
        }

        if (!captchaInput.trim()) {
            setError('Please enter the security verification CAPTCHA code.');
            return;
        }

        if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
            setError('Security CAPTCHA verification code is incorrect. Please try again.');
            generateCaptcha();
            return;
        }

        if (!selectedSystems || selectedSystems.length === 0) {
            setError('Please select at least one digital system to request access for.');
            return;
        }

        setLoading(true);

        try {
            // Extract drawn signature data URL if drawn
            const finalSigUrl = hasSignature ? signatureDataUrl : null;

            let payload;
            if (authorizationLetter) {
                payload = new FormData();
                Object.keys(registerData).forEach((key) => {
                    payload.append(key, registerData[key]);
                });
                payload.append('signature', finalSigUrl || '');
                payload.append('authorization_letter', authorizationLetter);
                payload.append('accessible_systems', JSON.stringify(selectedSystems));
            } else {
                payload = {
                    ...registerData,
                    signature: finalSigUrl,
                    accessible_systems: selectedSystems,
                };
            }

            await authService.register(payload);
            
            // Switch back to Login view
            setMode('login');
            setEmail(registerData.email);
            setPassword('');

            // Reset register form data
            setRegisterData({
                name: '',
                email: '',
                role: 'end_user',
                phone_number: '',
                address: '',
                office_id: '',
                designation: '',
                password: '',
                password_confirmation: '',
            });
            setSelectedSystems(['/eprocrementppmpapp']);
            setAuthorizationLetter(null);
            setAuthorizationLetterError('');
            if (authLetterInputRef.current) authLetterInputRef.current.value = '';
            clearSignature();
            generateCaptcha();

            // Open the pending approval popup message
            setShowPendingModal(true);
        } catch (err) {
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
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 text-slate-800 antialiased overflow-x-hidden">
            {/* ========================================================================= */}
            {/* LEFT PANEL: VISUAL HERO & CINEMATIC CAPITOL BACKGROUND (IMAGE PANEL)       */}
            {/* ========================================================================= */}
            <div className="w-full lg:w-[55%] xl:w-[58%] 2xl:w-[60%] relative flex flex-col justify-between overflow-hidden bg-blue-950 border-b lg:border-b-0 lg:border-r border-blue-900/40 min-h-[480px] sm:min-h-[520px] lg:h-screen lg:max-h-screen">
                
                {/* Background Image Layer with Cinematic Slow Pan Effect */}
                <div 
                    className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
                    style={{ 
                        backgroundImage: `url('/images/bg.jpg')`,
                    }}
                />

                {/* Bright, Clean, Friendly Civic Gradient Layers (No heavy black) */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-950/80 via-sky-900/40 to-transparent" />
                
                {/* Interactive Spider / Constellation Network Particles Canvas */}
                <SpiderParticlesCanvas className="absolute inset-0 pointer-events-none z-0 opacity-75" />
                
                {/* Soft Friendly Ambient Lighting Accents */}
                <div className="absolute -bottom-16 -left-16 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-10 right-10 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

                {/* Top Bar inside Visual Panel */}
                <div className="landing-fade-top relative z-10 px-4 sm:px-6 xl:px-8 py-3 xl:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/70 backdrop-blur-xl border border-white/20 text-white shadow-xl">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] xl:text-xs font-bold tracking-wider uppercase text-blue-100">OPPMO - BAC</span>
                        </div>
                        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 text-amber-200 text-[10px] xl:text-[11px] font-bold tracking-wider uppercase shadow-md font-mono">
                            <span>MULTI-SYSTEM GATEWAY</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs xl:text-sm font-extrabold text-white uppercase tracking-wider drop-shadow-md">
                                Office of the Provincial Procurement Management Officer
                            </p>
                            <p className="text-[10px] xl:text-[11px] text-amber-300 font-semibold tracking-wide uppercase drop-shadow-sm">
                                (OPPMO) • Bids and Awards Committee
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <img 
                                src="/images/logo.png" 
                                alt="Davao del Sur Official Seal" 
                                className="w-8 h-8 xl:w-9 xl:h-9 object-contain drop-shadow-lg"
                            />
                            <img 
                                src="/images/pmo.jpeg" 
                                alt="OPPMO Seal" 
                                className="w-8 h-8 xl:w-9 xl:h-9 object-contain rounded-full border border-white/30 shadow-md drop-shadow-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Center Hero Information Card */}
                <div className="relative z-10 px-4 sm:px-6 xl:px-10 py-2 sm:py-3 xl:py-4 max-w-4xl my-auto w-full">
                    <div className="landing-hero-title inline-flex items-center gap-2 px-3 py-1 bg-amber-500/25 border border-amber-300/40 rounded-lg text-amber-200 text-[11px] xl:text-xs font-mono font-bold tracking-wider uppercase mb-2 backdrop-blur-md shadow-sm soft-glow-badge">
                        <span>Province of Davao Del Sur • Unified Digital Gateway</span>
                    </div>

                    <h2 className="landing-hero-title text-xl sm:text-2xl xl:text-3xl 2xl:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-[0_2px_12px_rgba(15,23,42,0.8)]">
                        Provincial Multi-System Procurement Portal
                    </h2>

                    <p className="landing-hero-sub mt-1.5 sm:mt-2 text-xs xl:text-sm text-blue-50/95 leading-relaxed font-normal drop-shadow max-w-2xl">
                        Centralized single sign-on authentication and unified governance across Davao del Sur's digital procurement infrastructure, automated PPMP/APP workflows, real-time project implementation monitoring, and provincial supplier evaluations.
                    </p>

                    {/* Single Sign-On Multi-System Badge */}
                    <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-400/35 text-blue-200 text-[11px] font-semibold backdrop-blur-md shadow-sm">
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Unified SSO Credentials • One Account for All 3 Integrated Systems</span>
                    </div>

                    {/* Multi-System Cards Showcase with Proportional Sizing (No Overflow) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4 mt-3.5 sm:mt-4 xl:mt-5 perspective-[1000px] w-full">
                        {/* Card 1: E-Procurement PPMP & APP System */}
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

                        {/* Card 2: Real-Time Monitoring System */}
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

                        {/* Card 3: Supplier Evaluation System */}
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

                {/* Left Panel Bottom Bar */}
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

            {/* ========================================================================= */}
            {/* RIGHT PANEL: AUTHENTICATION FORM (SIGN IN & REGISTRATION)                 */}
            {/* ========================================================================= */}
            <div className="w-full lg:w-[45%] xl:w-[42%] 2xl:w-[40%] min-h-screen lg:h-screen flex flex-col justify-between bg-slate-50/95 relative z-20 shadow-2xl overflow-y-auto custom-scrollbar border-t lg:border-t-0 lg:border-l border-slate-200/80">
                
                {/* Top Subtle Amber & Navy Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-blue-600 to-indigo-600" />

                {/* Form Card Container (Expanded width) */}
                <div className="w-full max-w-lg 2xl:max-w-xl mx-auto px-4 sm:px-6 lg:px-7 py-4 sm:py-6 flex-1 flex flex-col justify-center">
                    
                    {/* Elevated Content Card (Expanded) with smooth landing transition */}
                    <div className="landing-auth-card bg-white rounded-2xl p-5 sm:p-7 shadow-lg shadow-slate-200/50 border border-slate-200/80 w-full my-auto">
                        
                        {onBackToLanding && (
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition mb-3 hover:underline"
                            >
                                <span>← Back to Portal Home</span>
                            </button>
                        )}

                        {/* Header: Logo & Identity */}
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

                        {/* Mode Toggle Switcher Tabs */}
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

                        {/* Error and Success Banners */}
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

                        {/* ========================================================================= */}
                        {/* FORM: SIGN IN MODE                                                       */}
                        {/* ========================================================================= */}
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

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading || lockoutSeconds > 0}
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
                            /* ========================================================================= */
                            /* FORM: REGISTRATION MODE                                                   */
                            /* ========================================================================= */
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

                                    {/* Searchable Office Dropdown */}
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

                                        {/* Dropdown Menu Panel */}
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

                                    {/* Multi-Select Systems Dropdown with Checkboxes */}
                                    <div className="relative" ref={systemsDropdownRef}>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Requested Digital Systems Access <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                                {selectedSystems.length} {selectedSystems.length === 1 ? 'system' : 'systems'} selected
                                            </span>
                                        </div>

                                        {/* Dropdown Button Trigger */}
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
                                                            const label = matched?.name || (url === '/monitoringsystem' ? 'Monitoring System' : 'PPMP & APP System');
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
                                                    <span className="text-xs text-slate-400">
                                                        -- Select Systems (Multi-select) --
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isSystemsDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Dropdown Menu with Checkboxes */}
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
                                                    {availableSystems.map((sys) => {
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label
                                                htmlFor="register-role"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
                                            >
                                                System Role <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Shield className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                </div>
                                                <select
                                                    id="register-role"
                                                    name="role"
                                                    required
                                                    value={registerData.role}
                                                    onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
                                                    className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm font-medium"
                                                >
                                                    <option value="end_user">End User (Preparer)</option>
                                                    <option value="head">Office Head / Approver</option>
                                                    <option value="authorized_staff">Authorize Staff</option>
                                                    <option value="budget_officer">Budget Officer</option>
                                                    <option value="oppmo">OPPMO Reviewer</option>
                                                    <option value="twg">BAC-TWG Reviewer</option>
                                                    <option value="pacco">PACCO Reviewer (Provincial Accounting)</option>
                                                    <option value="admin">Administrator</option>
                                                </select>
                                            </div>
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

                                    {/* Official Authorization Letter (PDF) Card - Shown when role === 'authorized_staff' */}
                                    {registerData.role === 'authorized_staff' && (
                                        <div className="p-3.5 bg-blue-50/70 border-2 border-blue-300 rounded-xl space-y-2.5 shadow-sm animate-fade-in-up">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                                                    <span className="block text-[11px] font-bold text-blue-950 uppercase tracking-wider">
                                                        Authorization Letter (PDF) <span className="text-rose-500">*</span>
                                                    </span>
                                                </div>
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
                                                    if (!file) return;

                                                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                                                        setAuthorizationLetterError('Only official PDF files are accepted.');
                                                        setAuthorizationLetter(null);
                                                        return;
                                                    }

                                                    if (file.size > 20 * 1024 * 1024) {
                                                        setAuthorizationLetterError('File size exceeds maximum limit of 20MB.');
                                                        setAuthorizationLetter(null);
                                                        return;
                                                    }

                                                    setAuthorizationLetterError('');
                                                    setAuthorizationLetter(file);
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
                                                                {authorizationLetter.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                {(authorizationLetter.size / 1024 / 1024).toFixed(2)} MB &bull; PDF Document Attached
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
                                                            PDF format up to 20MB &bull; Saved to secure private storage
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {authorizationLetterError && (
                                                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    {authorizationLetterError}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Digital E-Signature Specimen Card (Click to Draw in Modal - Required) */}
                                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 shadow-sm">
                                        <div className="flex items-center justify-between">
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

                                        {/* Clickable Area to launch Drawing Modal */}
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
                                                        <Check className="w-3 h-3" /> Signature captured
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
                                    </div>

                                    {/* Security Verification CAPTCHA */}
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label
                                                htmlFor="register-captcha"
                                                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider"
                                            >
                                                Security Verification (CAPTCHA) <span className="text-rose-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={generateCaptcha}
                                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                                                title="Click to generate a new CAPTCHA code"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Refresh
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div 
                                                onClick={generateCaptcha}
                                                className="select-none cursor-pointer px-4 py-2 bg-slate-900 text-white font-mono text-base font-black tracking-[0.35em] rounded-lg shadow-inner border border-slate-700 flex items-center justify-center relative overflow-hidden active:scale-95 transition-transform"
                                                title="Click to refresh CAPTCHA"
                                            >
                                                <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px] opacity-25 pointer-events-none" />
                                                <span className="relative z-10 italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] line-through decoration-amber-400/50">
                                                    {captchaCode}
                                                </span>
                                            </div>

                                            <div className="flex-1">
                                                <input
                                                    id="register-captcha"
                                                    name="captcha"
                                                    type="text"
                                                    autoComplete="off"
                                                    required
                                                    maxLength={5}
                                                    value={captchaInput}
                                                    onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                                                    placeholder="Enter 5-digit code"
                                                    className="w-full text-xs px-3.5 py-2 font-mono uppercase font-bold tracking-widest border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition shadow-sm bg-white"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 italic">
                                            Type the 5 alphanumeric characters shown above (not case-sensitive).
                                        </p>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
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

                {/* Right Panel Footer / Legal text */}
                <div className="w-full px-6 sm:px-10 py-4 border-t border-slate-200/60 bg-white/70 flex items-center justify-between text-[11px] text-slate-400">
                    <span>© {new Date().getFullYear()} Province of Davao del Sur</span>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-slate-200">
                        v2.5 Enterprise
                    </span>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODALS: PRIVACY NOTICE & PENDING APPROVAL DIALOGS                          */}
            {/* ========================================================================= */}
            
            {/* Data Privacy Notice Pop-up Modal */}
            {showPrivacyNotice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
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

                        {/* Modal Body / Notice Content */}
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

                        {/* Footer Actions */}
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

            {/* Pending Approval Pop-up Modal */}
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

            {/* Freeform Signature Drawing Studio Modal */}
            <SignaturePadModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSave={handleApplyModalSignature}
                initialDataUrl={signatureDataUrl}
                title="Draw Specimen Official Signature"
                description="Sign freely inside this large high-resolution studio. You can choose ink color, thickness, and undo strokes."
            />
        </div>
    );
};
