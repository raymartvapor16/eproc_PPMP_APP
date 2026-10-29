import React, { useState, useEffect } from 'react';
import { portalSystemService, oppmoTeamService } from '../../services/api';
import { canUserAccessSystem } from '../../components/UI/UnauthorizedSystemAccessView';
import {
    Shield,
    Lock,
    ExternalLink,
    ArrowRight,
    CheckCircle2,
    Building2,
    Users,
    FileSpreadsheet,
    Activity,
    Layers,
    Sparkles,
    Globe,
    Mail,
    Phone,
    MapPin,
    Clock,
    Award,
    FileText,
    TrendingUp,
    ShieldCheck,
    Check,
    Loader2,
    Eye,
    ShieldAlert,
    X,
    Scale,
    Briefcase,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

import { isExternalLink, normalizeDestinationUrl } from '../../components/Dashboard/PortalSystemsManagement';
import { SpiderParticlesCanvas } from '../../components/UI/SpiderParticlesCanvas';

export const LandingPage = ({ onLaunchDashboard, onLaunchEproc, onLaunchMonitoring, onOpenLogin, onOpenPrivacy, onLaunchSystem, user }) => {
    const [systems, setSystems] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loadingSystems, setLoadingSystems] = useState(true);
    const [loadingTeam, setLoadingTeam] = useState(true);
    const [scrolled, setScrolled] = useState(false);
    const [restrictedModalSys, setRestrictedModalSys] = useState(null);
    const [activeSection, setActiveSection] = useState('home');

    // Separate department head and staff members
    const departmentHead = teamMembers.find(
        (m) =>
            m.position?.toLowerCase().includes('department head') ||
            m.position?.toLowerCase().includes('head') ||
            m.position?.toLowerCase().includes('pgdh')
    ) || (teamMembers.length > 0 ? teamMembers[0] : null);

    const staffMembers = teamMembers.filter((m) => m.id !== departmentHead?.id);

    // Horizontal sliding state for staff members carousel
    const [teamSlide, setTeamSlide] = useState(0);
    const [isTeamPaused, setIsTeamPaused] = useState(false);
    const [cardsPerView, setCardsPerView] = useState(2);

    useEffect(() => {
        const updateCardsPerView = () => {
            let perView = 2;
            if (window.innerWidth < 640) {
                perView = 1;
            } else if (window.innerWidth < 1024) {
                perView = 2;
            } else if (window.innerWidth < 1536) {
                perView = 3;
            } else {
                perView = 4;
            }
            setCardsPerView(perView);
            setTeamSlide((prev) => Math.min(prev, Math.max(0, staffMembers.length - perView)));
        };
        updateCardsPerView();
        window.addEventListener('resize', updateCardsPerView);
        return () => window.removeEventListener('resize', updateCardsPerView);
    }, [staffMembers.length]);

    const maxTeamSlide = Math.max(0, staffMembers.length - cardsPerView);

    // Automatic slide in horizontal transition (every 3.8s, pauses on hover)
    useEffect(() => {
        if (staffMembers.length <= cardsPerView || isTeamPaused) return;

        const interval = setInterval(() => {
            setTeamSlide((prev) => (prev >= maxTeamSlide ? 0 : prev + 1));
        }, 3800);

        return () => clearInterval(interval);
    }, [staffMembers.length, cardsPerView, maxTeamSlide, isTeamPaused]);

    const handlePrevTeamSlide = () => {
        setTeamSlide((prev) => (prev <= 0 ? maxTeamSlide : prev - 1));
    };

    const handleNextTeamSlide = () => {
        setTeamSlide((prev) => (prev >= maxTeamSlide ? 0 : prev + 1));
    };

    const navTabs = [
        { id: 'home', label: 'Home', title: 'Executive Overview' },
        { id: 'systems', label: 'Digital Systems', title: 'Digital Systems' },
        { id: 'about', label: 'About OPPMO', title: 'Mandate & Governance' },
        { id: 'team', label: 'Our Team', title: 'Leadership & Specialists' },
        { id: 'contact', label: 'Contact', title: 'Inquiries & Portal Access' },
    ];

    const scrollTo = (id) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        let ticking = false;
        let lastScrolled = false;
        let lastSection = 'home';

        const updateScroll = () => {
            const currentScrollY = window.scrollY;
            const isScrolled = currentScrollY > 40;
            if (isScrolled !== lastScrolled) {
                lastScrolled = isScrolled;
                setScrolled(isScrolled);
            }

            // Presentation Slide Spy
            const sectionIds = ['home', 'systems', 'about', 'team', 'contact'];
            const scrollPos = currentScrollY + 220;
            let currentSec = 'home';
            for (let i = sectionIds.length - 1; i >= 0; i--) {
                const el = document.getElementById(sectionIds[i]);
                if (el && el.offsetTop <= scrollPos) {
                    currentSec = sectionIds[i];
                    break;
                }
            }

            if (currentSec !== lastSection) {
                lastSection = currentSec;
                setActiveSection(currentSec);
            }

            ticking = false;
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScroll);
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        updateScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    useEffect(() => {
        const fetchPublicData = async () => {
            try {
                const sysRes = await portalSystemService.getPublic();
                if (sysRes.data && sysRes.data.length > 0) {
                    setSystems(sysRes.data);
                }
            } catch (err) {
                console.warn('Using default systems on landing page', err);
            } finally {
                setLoadingSystems(false);
            }

            try {
                const teamRes = await oppmoTeamService.getPublic();
                if (teamRes.data && teamRes.data.length > 0) {
                    setTeamMembers(teamRes.data);
                }
            } catch (err) {
                console.warn('Using default team on landing page', err);
            } finally {
                setLoadingTeam(false);
            }
        };

        fetchPublicData();
    }, []);


    const handleSystemClick = (sys) => {
        const rawUrl = (sys?.link_url || '').trim();
        const isExternal = isExternalLink(rawUrl, sys?.is_external);

        if (isExternal) {
            const formattedUrl = normalizeDestinationUrl(rawUrl);
            window.open(formattedUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        // If user is logged in, verify authorized system access for internal route
        if (user && !canUserAccessSystem(user, rawUrl)) {
            setRestrictedModalSys(sys);
            return;
        }

        if (onLaunchSystem) {
            onLaunchSystem(sys);
            return;
        }

        if (rawUrl === '/monitoringsystem' || rawUrl.startsWith('/monitoring')) {
            onLaunchMonitoring();
            return;
        }

        if (rawUrl === '/privacy') {
            onOpenPrivacy();
            return;
        }

        // Default to E-Procurement PPMP/APP System
        onLaunchEproc();
    };

    const getSystemIcon = (iconName, color = 'blue') => {
        const props = { className: 'w-6 h-6 stroke-[1.8]' };
        switch (iconName) {
            case 'Activity': return <Activity {...props} />;
            case 'Shield': return <Shield {...props} />;
            case 'Layers': return <Layers {...props} />;
            case 'Globe': return <Globe {...props} />;
            case 'Sparkles': return <Sparkles {...props} />;
            default: return <FileSpreadsheet {...props} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
            {/* ─────────────────────────────────────────────────────────────
                1. STICKY TOP NAVBAR
            ───────────────────────────────────────────────────────────── */}
            <header
                className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
                    scrolled
                        ? 'bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 shadow-lg shadow-black/40 py-2.5'
                        : 'bg-gradient-to-b from-slate-950/90 to-transparent py-4'
                }`}
            >
                <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-between">
                    {/* Brand */}
                    <div 
                        className="flex items-center gap-3 cursor-pointer group transition-all duration-300 hover:opacity-95" 
                        onClick={() => scrollTo('home')}
                    >
                        <div className="flex items-center gap-2">
                            <img
                                src="/images/logo.png"
                                alt="Davao del Sur Seal"
                                className="w-10 h-10 object-contain drop-shadow transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <img
                                src="/images/pmo.jpeg"
                                alt="OPPMO Seal"
                                className="w-10 h-10 object-cover rounded-full border border-amber-400/40 shadow-xs transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-black tracking-wide uppercase text-white flex items-center gap-1.5 transition-colors duration-300 group-hover:text-amber-300">
                                <span>OPPMO</span>
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-bold border border-amber-500/30">
                                    PORTAL
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase transition-colors duration-300 group-hover:text-slate-300">
                                Province of Davao del Sur
                            </div>
                        </div>
                    </div>

                    {/* Desktop Presentation Navigation Tabs */}
                    <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/85 border border-slate-800/90 backdrop-blur-xl shadow-inner">
                        {navTabs.map((tab) => {
                            const isActive = activeSection === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => scrollTo(tab.id)}
                                    className={`relative px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 group cursor-pointer ${
                                        isActive
                                            ? 'bg-gradient-to-r from-amber-500/25 via-blue-500/15 to-amber-500/25 text-amber-300 border border-amber-400/40 shadow-md shadow-amber-500/15'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                                    }`}
                                >
                                    <span className="tracking-wide uppercase font-semibold">{tab.label}</span>

                                    {/* Active Indicator Pulse Dot */}
                                    {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Action Button */}
                    <div className="flex items-center gap-3">
                        {user ? (
                            <button
                                onClick={onLaunchDashboard || onLaunchEproc}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 border border-blue-400/30 transition-all duration-300 hover:scale-105 active:scale-95"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <button
                                onClick={() => scrollTo('systems')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 border border-amber-300/40 transition-all duration-300 hover:scale-105 active:scale-95"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Sign In / Portal Access</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile / Compact Slide Switcher Bar */}
                <div className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-4 bg-slate-950/95 border-t border-slate-900">
                    {navTabs.map((tab) => {
                        const isActive = activeSection === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => scrollTo(tab.id)}
                                className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                                }`}
                            >
                                <span className="uppercase">{tab.label}</span>
                                {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* ─────────────────────────────────────────────────────────────
                2. HERO SECTION
            ───────────────────────────────────────────────────────────── */}
            <section id="home" className="relative pt-32 pb-24 md:pt-44 md:pb-36 overflow-hidden">
                {/* Background Ambience */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url('/images/bg.jpg')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/85 to-slate-950 pointer-events-none" />

                {/* Interactive Spider / Constellation Particle Web Network */}
                <SpiderParticlesCanvas className="absolute inset-0 pointer-events-none z-0" />

                {/* Animated Gradient Glow Orbs */}
                <div className="landing-aura-glow absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/25 via-indigo-500/20 to-amber-500/20 blur-[120px] rounded-full pointer-events-none z-0" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center presentation-hero-entry">
                    {/* Presentation Horizontal Aperture Light Beam */}
                    <div className="presentation-aperture-beam" />

                    {/* Presentation Badge */}
                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider shadow-lg shadow-amber-500/10 mb-6 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-amber-400 hover:bg-slate-900 cursor-default">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span className="font-mono text-[11px] text-amber-400 font-extrabold tracking-widest">EXECUTIVE PRESENTATION</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-200">Republic of the Philippines • Province of Davao del Sur</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.15]">
                        Office of the Provincial Procurement{' '}
                        <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400 bg-clip-text text-transparent drop-shadow-sm">
                            Management Officer
                        </span>
                    </h1>

                    {/* Subheading */}
                    <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto mt-6 leading-relaxed">
                        Integrated Digital Procurement Governance, Automated PPMP/APP Workflow Lifecycle, and Real-Time Project Implementation Monitoring for the Provincial Government.
                    </p>

                    {/* CTA Buttons */}
                    <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={onLaunchEproc}
                            className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide uppercase shadow-xl shadow-blue-600/30 border border-blue-400/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40 hover:brightness-105 active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                            <span>Launch E-Procurement PPMP/APP</span>
                            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                        </button>

                        <button
                            onClick={() => scrollTo('systems')}
                            className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-200 hover:text-white font-semibold text-sm border border-slate-700/80 hover:border-slate-500 transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 backdrop-blur-sm"
                        >
                            <Layers className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                            <span>Explore All Systems</span>
                        </button>
                    </div>

                    {/* ─────────────────────────────────────────────────────────────
                        Key Stats / Statutory Pillars with Floating Presentation Opening
                    ───────────────────────────────────────────────────────────── */}
                    <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto perspective-[1200px]">
                        {/* Card 1: Statutory Compliance (Amber) */}
                        <div className="presentation-card-1">
                            <div className="landing-card-float-1 h-full">
                                <div className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/95 border border-amber-500/25 hover:border-amber-400/80 backdrop-blur-xl shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.03] text-left flex flex-col justify-between h-full cursor-default">
                                    {/* Top Accent Gradient Bar */}
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 opacity-70 group-hover:opacity-100 group-hover:h-1.5 transition-all duration-300" />
                                    
                                    {/* Ambient Background Aura */}
                                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/25 transition-colors duration-500" />
                                    
                                    {/* Shimmer Reflection */}
                                    <div className="shimmer-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:bg-amber-500/25 transition-all duration-300">
                                                <Scale className="w-5 h-5 stroke-[2]" />
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider shadow-xs transition-all duration-300 group-hover:border-amber-400/60 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                <span>MANDATE &amp; COMPLIANCE</span>
                                            </span>
                                        </div>

                                        <div className="text-xl sm:text-2xl font-black tracking-tight leading-tight bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-400 bg-clip-text text-transparent group-hover:drop-shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all duration-300">
                                            (RA 12009 / RA 9184)
                                        </div>

                                        <div className="text-sm font-bold text-white mt-2 group-hover:text-amber-200 transition-colors">
                                            Full Statutory Compliance
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                            Strict adherence to the New GPRA standard and national procurement reforms.
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-400/90 font-medium">
                                        <span className="font-mono text-[10px]">Verified Legal Framework</span>
                                        <ShieldCheck className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Digital PPMP Lifecycle (Blue) */}
                        <div className="presentation-card-2">
                            <div className="landing-card-float-2 h-full">
                                <div className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/95 border border-blue-500/25 hover:border-blue-400/80 backdrop-blur-xl shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.03] text-left flex flex-col justify-between h-full cursor-default">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-300 to-blue-500 opacity-70 group-hover:opacity-100 group-hover:h-1.5 transition-all duration-300" />
                                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/25 transition-colors duration-500" />
                                    <div className="shimmer-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:bg-blue-500/25 transition-all duration-300">
                                                <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider shadow-xs transition-all duration-300 group-hover:border-blue-400/60 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                <span>PPMP LIFECYCLE</span>
                                            </span>
                                        </div>

                                        <div className="text-3xl sm:text-4xl font-black tracking-tight leading-tight bg-gradient-to-r from-sky-200 via-blue-400 to-indigo-400 bg-clip-text text-transparent group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-all duration-300">
                                            100%
                                        </div>

                                        <div className="text-sm font-bold text-white mt-2 group-hover:text-blue-200 transition-colors">
                                            Digital PPMP Lifecycle
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                            Paperless workflow routing from End Users to BAC & PBO approval.
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-blue-400/90 font-medium">
                                        <span className="font-mono text-[10px]">Zero Paper Bottlenecks</span>
                                        <CheckCircle2 className="w-4 h-4 text-blue-400 transition-transform duration-300 group-hover:scale-110" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Real-Time PIMS Tracking (Emerald) */}
                        <div className="presentation-card-3">
                            <div className="landing-card-float-3 h-full">
                                <div className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/95 border border-emerald-500/25 hover:border-emerald-400/80 backdrop-blur-xl shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.03] text-left flex flex-col justify-between h-full cursor-default">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 opacity-70 group-hover:opacity-100 group-hover:h-1.5 transition-all duration-300" />
                                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors duration-500" />
                                    <div className="shimmer-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:bg-emerald-500/25 transition-all duration-300">
                                                <Activity className="w-5 h-5 stroke-[2]" />
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider shadow-xs transition-all duration-300 group-hover:border-emerald-400/60 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                <span>LIVE MILESTONE SYNC</span>
                                            </span>
                                        </div>

                                        <div className="text-2xl sm:text-3xl font-black tracking-tight leading-tight bg-gradient-to-r from-emerald-200 via-emerald-400 to-teal-300 bg-clip-text text-transparent group-hover:drop-shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-300">
                                            Real-Time
                                        </div>

                                        <div className="text-sm font-bold text-white mt-2 group-hover:text-emerald-200 transition-colors">
                                            PIMS Milestone Tracking
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                            Live stage tracking across Pre-Procurement, Bidding, and Delivery.
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400/90 font-medium">
                                        <span className="font-mono text-[10px]">Synchronized Stages</span>
                                        <TrendingUp className="w-4 h-4 text-emerald-400 transition-transform duration-300 group-hover:scale-110" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card 4: Zero Loss Encrypted Audit (Purple) */}
                        <div className="presentation-card-4">
                            <div className="landing-card-float-4 h-full">
                                <div className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/95 border border-purple-500/25 hover:border-purple-400/80 backdrop-blur-xl shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.03] text-left flex flex-col justify-between h-full cursor-default">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-300 to-purple-500 opacity-70 group-hover:opacity-100 group-hover:h-1.5 transition-all duration-300" />
                                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/25 transition-colors duration-500" />
                                    <div className="shimmer-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 group-hover:bg-purple-500/25 transition-all duration-300">
                                                <Lock className="w-5 h-5 stroke-[2]" />
                                            </div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider shadow-xs transition-all duration-300 group-hover:border-purple-400/60 font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                                <span>COA AUDIT READY</span>
                                            </span>
                                        </div>

                                        <div className="text-2xl sm:text-3xl font-black tracking-tight leading-tight bg-gradient-to-r from-purple-200 via-purple-400 to-fuchsia-300 bg-clip-text text-transparent group-hover:drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] transition-all duration-300">
                                            Zero Loss
                                        </div>

                                        <div className="text-sm font-bold text-white mt-2 group-hover:text-purple-200 transition-colors">
                                            Encrypted Audit Records
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                            Tamper-evident logs and cryptographic audit trail for every action.
                                        </p>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-purple-400/90 font-medium">
                                        <span className="font-mono text-[10px]">COA & Statutory Compliance</span>
                                        <Shield className="w-4 h-4 text-purple-400 transition-transform duration-300 group-hover:scale-110" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────────
                3. PROVINCIAL SYSTEMS CATALOG (CARDS) - SLIDE 02
            ───────────────────────────────────────────────────────────── */}
            <section id="systems" className="py-20 scroll-mt-20 relative bg-slate-900/50 border-t border-slate-800/60 overflow-hidden presentation-slide-entry">
                {/* Section Slide Aperture Light Beam */}
                <div className="presentation-aperture-beam" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-14">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider border border-blue-500/30 mb-3 shadow-xs transition-all duration-300 hover:scale-105 cursor-default">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                            <Layers className="w-3.5 h-3.5" />
                            <span>DIGITAL INFRASTRUCTURE</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                            Provincial Digital Procurement Systems
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base mt-3">
                            Official digital systems maintained by the Office of the Provincial Procurement Management Officer for transparent, accountable, and swift procurement governance.
                        </p>
                    </div>

                    {loadingSystems ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-mono">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                            <p className="text-sm font-semibold">Loading digital systems...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {systems.map((sys, idx) => {
                                const isEmerald = sys.color === 'emerald';
                                const isAmber = sys.color === 'amber';
                                const isPurple = sys.color === 'purple';
                                const staggerClass = `presentation-stagger-${(idx % 4) + 1}`;
                                const floatClass = `landing-card-float-${(idx % 4) + 1}`;

                                return (
                                    <div key={sys.id} className={`${staggerClass} h-full`}>
                                        <div className={`${floatClass} h-full`}>
                                            <div
                                                className={`group relative bg-slate-900/80 hover:bg-slate-900/95 rounded-2xl p-6 border transition-all duration-500 ease-out flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] overflow-hidden h-full ${
                                                    isEmerald
                                                        ? 'border-emerald-500/30 hover:border-emerald-400 hover:shadow-emerald-500/15'
                                                        : isAmber
                                                        ? 'border-amber-500/30 hover:border-amber-400 hover:shadow-amber-500/15'
                                                        : isPurple
                                                        ? 'border-purple-500/30 hover:border-purple-400 hover:shadow-purple-500/15'
                                                        : 'border-blue-500/30 hover:border-blue-400 hover:shadow-blue-500/15'
                                                }`}
                                            >
                                                {/* Subtle Shimmer Sweep */}
                                                <div className="shimmer-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                                <div>
                                                    {/* Top Tag & Icon */}
                                                    <div className="flex items-start justify-between gap-3 mb-5">
                                                        <div
                                                            className={`p-3 rounded-xl border transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner ${
                                                                isEmerald
                                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/25'
                                                                    : isAmber
                                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 group-hover:bg-amber-500/25'
                                                                    : isPurple
                                                                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400 group-hover:bg-purple-500/25'
                                                                    : 'bg-blue-500/15 border-blue-500/30 text-blue-400 group-hover:bg-blue-500/25'
                                                            }`}
                                                        >
                                                            {getSystemIcon(sys.icon, sys.color)}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-1 font-mono">
                                                            <span
                                                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border transition-all duration-300 shadow-xs ${
                                                                    isEmerald
                                                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 group-hover:border-emerald-400/60'
                                                                        : isAmber
                                                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 group-hover:border-amber-400/60'
                                                                        : isPurple
                                                                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30 group-hover:border-purple-400/60'
                                                                        : 'bg-blue-500/10 text-blue-300 border-blue-500/30 group-hover:border-blue-400/60'
                                                                }`}
                                                            >
                                                                {sys.badge || 'Portal System'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* System Title */}
                                                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors duration-300">
                                                        {sys.name}
                                                    </h3>

                                                    {/* Description */}
                                                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed line-clamp-3 transition-colors duration-300 group-hover:text-slate-200">
                                                        {sys.description}
                                                    </p>
                                                </div>

                                                {/* Launch CTA */}
                                                <div className="mt-6 pt-4 border-t border-slate-800">
                                                    <button
                                                        onClick={() => handleSystemClick(sys)}
                                                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-md hover:scale-[1.02] hover:brightness-110 active:scale-95 ${
                                                            isEmerald
                                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:shadow-emerald-500/30'
                                                                : isAmber
                                                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 hover:shadow-amber-500/30'
                                                                : isPurple
                                                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20 hover:shadow-purple-500/30'
                                                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 hover:shadow-blue-500/30'
                                                        }`}
                                                    >
                                                        <span>Launch System</span>
                                                        {isExternalLink(sys.link_url, sys.is_external) ? (
                                                            <ExternalLink className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
                                                        ) : (
                                                            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────────
                4. ABOUT OPPMO OFFICE SECTION - SLIDE 03
            ───────────────────────────────────────────────────────────── */}
            <section id="about" className="py-20 scroll-mt-20 relative overflow-hidden presentation-slide-entry">
                {/* Background Spider / Constellation Network Canvas */}
                <SpiderParticlesCanvas className="absolute inset-0 pointer-events-none z-0 opacity-80" />

                {/* Section Slide Aperture Light Beam */}
                <div className="presentation-aperture-beam" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider border border-amber-500/30 mb-3 shadow-xs transition-all duration-300 hover:scale-105 cursor-default">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <Building2 className="w-3.5 h-3.5" />
                                <span>STATUTORY MANDATE &amp; PILLARS</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                                Delivering Excellence in Public Procurement
                            </h2>
                            <p className="text-slate-300 text-sm leading-relaxed mt-4">
                                The <strong>Office of the Provincial Procurement Management Officer (OPPMO)</strong> serves as the central administrative backbone for all procurement plans, bidding activities, and contract awards of the Provincial Government of Davao del Sur.
                            </p>
                            <p className="text-slate-400 text-sm leading-relaxed mt-3">
                                In strict compliance with <em>Republic Act No. 9184</em> and the New GPRA <em>Republic Act No. 12009</em>, we oversee the standardization of Project Procurement Management Plans (PPMP), consolidation into the official Annual Procurement Plan (APP), and real-time execution monitoring.
                            </p>

                            {/* Core Pillars with Presentation Stagger & Float */}
                            <div className="mt-8 space-y-3.5">
                                <div className="presentation-stagger-1">
                                    <div className="landing-card-float-1">
                                        <div className="flex items-start gap-3 bg-slate-900/60 hover:bg-slate-900/90 p-4 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 group cursor-default">
                                            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-bold">CORE PILLAR</span>
                                                    <div className="text-sm font-bold text-white transition-colors duration-300 group-hover:text-emerald-300">
                                                        Full Transparency &amp; Anti-Corruption Safeguards
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Automated timestamped routing logs, tamper-evident e-signatures, and verified BAC review tracks.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="presentation-stagger-2">
                                    <div className="landing-card-float-2">
                                        <div className="flex items-start gap-3 bg-slate-900/60 hover:bg-slate-900/90 p-4 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 group cursor-default">
                                            <TrendingUp className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase font-bold">CORE PILLAR</span>
                                                    <div className="text-sm font-bold text-white transition-colors duration-300 group-hover:text-blue-300">
                                                        Fast-Tracked Multi-Tier Workflow
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Streamlined review between Department Heads, Provincial Budget Office, PACCO, and TWG evaluators.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="presentation-stagger-3">
                                    <div className="landing-card-float-3">
                                        <div className="flex items-start gap-3 bg-slate-900/60 hover:bg-slate-900/90 p-4 rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 group cursor-default">
                                            <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-bold">CORE PILLAR</span>
                                                    <div className="text-sm font-bold text-white transition-colors duration-300 group-hover:text-amber-300">
                                                        Strategic Budget Optimization
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Ensuring every centavo allocated from General, Trust, and Special Education Funds generates maximum public value.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visual Right Column with Float & Stagger */}
                        <div className="relative presentation-stagger-4">
                            <div className="landing-card-float-4">
                                <div className="group relative mx-auto rounded-3xl overflow-hidden border border-slate-700/80 hover:border-slate-600 shadow-2xl bg-slate-900 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/60">
                                    <img
                                        src="/images/bg.jpg"
                                        alt="Provincial Capitol"
                                        className="w-full h-80 object-cover opacity-75 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-85"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-amber-400/40 text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider backdrop-blur-md">
                                            PROVINCIAL CAPITOL
                                        </span>
                                    </div>
                                    <div className="absolute bottom-6 inset-x-6 transition-transform duration-300 group-hover:translate-y-[-2px]">
                                        <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                                            Provincial Capitol of Davao del Sur
                                        </div>
                                        <div className="text-lg font-bold text-white mt-1">
                                            Matti, Digos City, Davao del Sur
                                        </div>
                                        <div className="text-xs text-slate-300 mt-1">
                                            Office of the Provincial Governor • OPPMO
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────────
                5. OPPMO TEAM & LEADERSHIP SECTION - SLIDE 04
            ───────────────────────────────────────────────────────────── */}
            <section id="team" className="py-20 scroll-mt-20 relative bg-slate-900/40 border-t border-slate-800/60 overflow-hidden presentation-slide-entry">
                {/* Section Slide Aperture Light Beam */}
                <div className="presentation-aperture-beam" />

                <div className="relative w-full px-3 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14 z-10">
                    <div className="text-center max-w-4xl mx-auto mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider border border-amber-500/30 mb-3 shadow-xs transition-all duration-300 hover:scale-105 cursor-default">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <Users className="w-3.5 h-3.5" />
                            <span>LEADERSHIP &amp; SPECIALISTS</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                            The OPPMO Office Team
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base mt-2.5">
                            Dedicated public servants upholding the standards of integrity, transparency, and timely procurement delivery for our province.
                        </p>
                    </div>

                    {loadingTeam ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-mono">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                            <p className="text-sm font-semibold">Loading team members...</p>
                        </div>
                    ) : teamMembers.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 text-sm">
                            No OPPMO team members currently listed.
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-stretch w-full">
                            {/* ─────────────────────────────────────────────────────────────
                                LEFT: PROVINCIAL GOVERNMENT DEPARTMENT HEAD (SOLITARY CARD)
                            ───────────────────────────────────────────────────────────── */}
                            {departmentHead && (
                                <div className="w-full lg:w-[33.33%] xl:w-[25%] 2xl:w-[20%] shrink-0 flex flex-col">
                                    <div className="h-10 flex items-center gap-2 mb-3">
                                        <Award className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300 truncate">
                                            DEPARTMENT HEAD
                                        </span>
                                    </div>

                                    {/* Dedicated Solitary Department Head Card */}
                                    <div className="group/head relative bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-slate-950/95 rounded-2xl overflow-hidden border-2 border-amber-400/50 hover:border-amber-300 shadow-2xl shadow-amber-500/10 hover:shadow-amber-500/25 transition-all duration-500 flex flex-col h-full hover:-translate-y-1.5 backdrop-blur-xl">
                                        {/* Top Accent Gradient Line */}
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 z-10" />

                                        {/* Shimmer sweep reflection */}
                                        <div className="shimmer-shine opacity-0 group-hover/head:opacity-100 transition-opacity duration-700 z-10 pointer-events-none" />

                                        {/* Corner Leadership Badge */}
                                        <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-400/60 text-amber-300 font-mono text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-xl">
                                            <Award className="w-3.5 h-3.5 text-amber-400" />
                                            <span>DEPARTMENT HEAD</span>
                                        </div>

                                        {/* Portrait */}
                                        <div className="relative aspect-[4/4.3] w-full bg-slate-950/90 overflow-hidden">
                                            {departmentHead.photo_url ? (
                                                <>
                                                    <img
                                                        src={departmentHead.photo_url}
                                                        alt={departmentHead.name}
                                                        className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover/head:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-85" />
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 text-slate-400 p-6 relative overflow-hidden">
                                                    <Shield className="w-36 h-36 text-slate-800/25 absolute -bottom-6 -right-6 pointer-events-none" />
                                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/25 via-blue-500/20 to-amber-500/25 text-amber-300 font-black text-2xl flex items-center justify-center border border-amber-400/50 shadow-inner">
                                                        {departmentHead.name.charAt(0)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Body */}
                                        <div className="p-5 flex flex-col justify-between flex-1">
                                            <div>
                                                <h3 className="text-lg sm:text-xl font-black text-white group-hover/head:text-amber-300 transition-colors duration-200 tracking-tight leading-snug">
                                                    {departmentHead.name}
                                                </h3>
                                                <div className="mt-2 text-xs font-bold text-amber-400 flex items-start gap-2">
                                                    <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                                                        <Briefcase className="w-3 h-3" />
                                                    </div>
                                                    <span className="leading-snug break-words whitespace-normal">{departmentHead.position}</span>
                                                </div>
                                                {departmentHead.bio && (
                                                    <p className="mt-2.5 text-xs text-slate-300/90 leading-relaxed font-normal line-clamp-3">
                                                        {departmentHead.bio}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-auto pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400/90 font-mono">
                                                <span className="text-[11px] font-semibold text-amber-300/80">Executive Leadership</span>
                                                <ShieldCheck className="w-4 h-4 text-amber-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─────────────────────────────────────────────────────────────
                                RIGHT: OPPMO STAFF MEMBERS (CAROUSEL / SLIDER ASIDE)
                            ───────────────────────────────────────────────────────────── */}
                            <div className={`${departmentHead ? 'w-full lg:w-[66.67%] xl:w-[75%] 2xl:w-[80%] flex-1 min-w-0' : 'w-full'} flex flex-col justify-between`}>
                                <div className="h-10 flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-sky-400 shrink-0" />
                                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-300 truncate">
                                            OPPMO STAFF &amp; SPECIALISTS ({staffMembers.length})
                                        </span>
                                    </div>

                                    {/* Carousel Controls */}
                                    {staffMembers.length > cardsPerView && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={handlePrevTeamSlide}
                                                className="w-8 h-8 rounded-full bg-slate-900/95 hover:bg-amber-500 hover:text-slate-950 text-amber-400 shadow-md border border-amber-500/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                                                title="Previous Staff"
                                                aria-label="Previous Staff"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={handleNextTeamSlide}
                                                className="w-8 h-8 rounded-full bg-slate-900/95 hover:bg-amber-500 hover:text-slate-950 text-amber-400 shadow-md border border-amber-500/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                                                title="Next Staff"
                                                aria-label="Next Staff"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Carousel Viewport */}
                                <div 
                                    className="relative overflow-hidden py-1 -mx-2 sm:-mx-2.5 flex-1 flex flex-col justify-start"
                                    onMouseEnter={() => setIsTeamPaused(true)}
                                    onMouseLeave={() => setIsTeamPaused(false)}
                                >
                                    <div
                                        className={`flex items-stretch h-full transition-transform duration-700 ease-out ${staffMembers.length <= cardsPerView ? 'justify-start' : ''}`}
                                        style={{
                                            transform: staffMembers.length > cardsPerView ? `translate3d(-${teamSlide * (100 / cardsPerView)}%, 0, 0)` : 'none',
                                            willChange: 'transform',
                                        }}
                                    >
                                        {staffMembers.map((member) => (
                                            <div
                                                key={member.id}
                                                className="shrink-0 px-2 sm:px-2.5 w-full sm:w-1/2 lg:w-1/2 xl:w-1/3 2xl:w-1/4 flex flex-col h-full"
                                            >
                                                {/* Staff Member Card */}
                                                <div className="group/card relative bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950/95 rounded-2xl overflow-hidden border border-slate-800/90 hover:border-sky-400/60 shadow-xl shadow-black/50 hover:shadow-2xl hover:shadow-sky-500/15 transition-all duration-500 flex flex-col h-full hover:-translate-y-1.5 backdrop-blur-xl">
                                                    {/* Top Accent Gradient Line */}
                                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400 opacity-70 group-hover/card:opacity-100 transition-all duration-300 z-10" />

                                                    {/* Shimmer sweep reflection */}
                                                    <div className="shimmer-shine opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 z-10 pointer-events-none" />

                                                    {/* Photo Portrait */}
                                                    <div className="relative aspect-[4/4.3] w-full bg-slate-950/90 overflow-hidden">
                                                        {member.photo_url ? (
                                                            <>
                                                                <img
                                                                    src={member.photo_url}
                                                                    alt={member.name}
                                                                    className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover/card:scale-105"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-85" />
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 text-slate-400 p-6 relative overflow-hidden">
                                                                <Shield className="w-32 h-32 text-slate-800/25 absolute -bottom-6 -right-6 pointer-events-none" />
                                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-blue-500/15 to-sky-500/20 text-sky-300 font-black text-xl flex items-center justify-center border border-sky-400/40 shadow-inner transition-transform duration-300 group-hover/card:scale-110">
                                                                    {member.name.charAt(0)}
                                                                </div>
                                                                <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest mt-3 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30">
                                                                    OPPMO OFFICER
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Body */}
                                                    <div className="p-5 flex flex-col justify-between flex-1">
                                                        <div>
                                                            <h4 className="text-lg sm:text-xl font-bold text-white group-hover/card:text-sky-300 transition-colors duration-200 tracking-tight leading-snug">
                                                                {member.name}
                                                            </h4>
                                                            <div className="mt-2 text-xs font-semibold text-amber-400 flex items-start gap-2">
                                                                <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                                                                    <Briefcase className="w-3 h-3" />
                                                                </div>
                                                                <span className="leading-snug break-words whitespace-normal">{member.position}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-sky-400/90 font-mono">
                                                            <span className="text-[11px] font-semibold text-sky-300/80">Procurement Staff</span>
                                                            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Pagination Dots */}
                                {staffMembers.length > cardsPerView && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        {Array.from({ length: maxTeamSlide + 1 }).map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setTeamSlide(i)}
                                                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                                                    i === teamSlide
                                                        ? 'w-6 bg-sky-400 shadow-[0_0_8px_#38bdf8]'
                                                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                                                }`}
                                                title={`Go to staff slide ${i + 1}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────────
                6. CONTACT & LOCATION SECTION - SLIDE 05
            ───────────────────────────────────────────────────────────── */}
            <section id="contact" className="py-20 scroll-mt-20 relative bg-slate-950 overflow-hidden presentation-slide-entry">
                {/* Background Spider / Constellation Network Canvas */}
                <SpiderParticlesCanvas className="absolute inset-0 pointer-events-none z-0 opacity-80" />

                {/* Section Slide Aperture Light Beam */}
                <div className="presentation-aperture-beam" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl relative overflow-hidden transition-all duration-500 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-black/50">
                        <div className="landing-aura-glow absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                            <div className="presentation-stagger-1">
                                <div className="landing-card-float-1">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider border border-amber-500/30 mb-3 shadow-xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                        <span>OFFICIAL COORDINATION &amp; INQUIRIES</span>
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                                        Office of the Provincial Procurement Management Officer
                                    </h2>
                                    <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                                        For inquiries regarding Project Procurement Management Plans, BAC notices, supplier accreditations, and PPMP review status:
                                    </p>

                                    <div className="mt-6 space-y-3.5 text-xs text-slate-300">
                                        <div className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1.5 group cursor-default">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:scale-110 shadow-xs">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <span className="transition-colors duration-300 group-hover:text-white">Provincial Capitol Compound, Barangay Matti, Digos City, Davao del Sur</span>
                                        </div>

                                        <div className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1.5 group cursor-default">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:scale-110 shadow-xs">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <span className="transition-colors duration-300 group-hover:text-white">Monday to Friday • 8:00 AM – 5:00 PM (Except Holidays)</span>
                                        </div>

                                        <div className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1.5 group cursor-default">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 shrink-0 transition-all duration-300 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:scale-110 shadow-xs">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <span className="transition-colors duration-300 group-hover:text-white">bac.davaodelsur2@gmail.com • system.administrator16@gmail.com</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Direct Action Card */}
                            <div className="presentation-stagger-2 h-full">
                                <div className="landing-card-float-2 h-full">
                                    <div className="bg-slate-950/70 hover:bg-slate-950/90 rounded-2xl p-6 border border-slate-700/80 hover:border-slate-600 backdrop-blur-md flex flex-col justify-between transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/50 group h-full">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
                                                    <span>Authorized Implementing Unit Personnel</span>
                                                </div>
                                                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase">
                                                    DIRECT ACCESS
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                                                If you are an assigned End User, Office Head, Budget Officer, or TWG evaluator, proceed directly to the portal to manage or review procurement documents.
                                            </p>
                                        </div>

                                        <div className="mt-6 space-y-2.5">
                                            <button
                                                onClick={() => scrollTo('systems')}
                                                className="group/btn w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                                            >
                                                <span>Access E-Procurement Dashboard</span>
                                                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1.5" />
                                            </button>

                                            <button
                                                onClick={() => scrollTo('systems')}
                                                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-all duration-300 hover:scale-[1.02] active:scale-95"
                                            >
                                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Sign In with Credentials</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────────────────────────────────────────────────────────
                7. FOOTER
            ───────────────────────────────────────────────────────────── */}
            <footer className="py-10 border-t border-slate-900 bg-slate-950 text-xs text-slate-400">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div className="flex items-center gap-3 transition-transform duration-300 hover:scale-[1.01]">
                        <img src="/images/logo.png" alt="Logo" className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        <span>© {new Date().getFullYear()} Provincial Government of Davao del Sur. All Rights Reserved.</span>
                    </div>

                    <div className="flex items-center gap-6 text-[11px] font-semibold text-slate-400">
                        <button onClick={onOpenPrivacy} className="hover:text-amber-400 hover:scale-105 active:scale-95 transition-all duration-300">
                            Data Privacy Policy
                        </button>
                        <span>•</span>
                        <button onClick={onLaunchEproc} className="hover:text-amber-400 hover:scale-105 active:scale-95 transition-all duration-300">
                            E-Procurement
                        </button>
                        <span>•</span>
                        <button onClick={() => scrollTo('home')} className="hover:text-amber-400 hover:-translate-y-0.5 active:scale-95 transition-all duration-300">
                            Back to Top ↑
                        </button>
                    </div>
                </div>
            </footer>

            {/* Restricted System Access Modal */}
            {restrictedModalSys && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                        <button
                            onClick={() => setRestrictedModalSys(null)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4">
                            <ShieldAlert className="w-6 h-6" />
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/30 mb-2">
                            <Lock className="w-3 h-3" />
                            Access Restricted
                        </div>

                        <h3 className="text-lg font-bold text-white">
                            {restrictedModalSys.name}
                        </h3>

                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                            Your signed-in account (<span className="text-white font-medium">{user?.email}</span>) is not authorized to access this provincial digital system.
                        </p>

                        <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed space-y-1">
                            <span className="font-semibold text-amber-400 block">Personal Request Required (Face-to-Face):</span>
                            Under provincial procurement security policy, requests to enable access to this system must be submitted in person (face-to-face) to the OPPMO / BAC Secretariat or your System Administrator.
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setRestrictedModalSys(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                            >
                                Understand & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
