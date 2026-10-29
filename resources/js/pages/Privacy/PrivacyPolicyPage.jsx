import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2, Building, Eye, UserCheck, Scale } from 'lucide-react';

export const PrivacyPolicyPage = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Sign In</span>
                            </button>
                        )}
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-1.5 shrink-0">
                                <img 
                                    src="/images/logo.png" 
                                    alt="Province of Davao del Sur Seal" 
                                    className="w-8 h-8 object-contain drop-shadow-sm" 
                                />
                                <img 
                                    src="/images/pmo.jpeg" 
                                    alt="OPPMO Seal" 
                                    className="w-8 h-8 object-contain rounded-full border border-white/20 shadow-xs" 
                                />
                            </div>
                            <div>
                                <h1 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                                    Province of Davao del Sur
                                </h1>
                                <p className="text-[10px] text-blue-400 font-mono hidden sm:block">
                                    E-Procurement PPMP/APP System
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            R.A. 10173 Compliant
                        </span>
                    </div>
                </div>
            </header>

            {/* Hero Banner */}
            <section className="relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-600/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
                        <Scale className="w-3.5 h-3.5 text-blue-400" />
                        Official Government Transparency & Data Protection Notice
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
                        Data Privacy Policy
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        Notice and policy on the collection, protection, processing, and management of personal and official data for the Province of Davao del Sur E-Procurement PPMP/APP System.
                    </p>
                    <p className="text-xs text-slate-400 font-mono pt-1">
                        In Compliance with Republic Act No. 10173 (Data Privacy Act of 2012) and National Privacy Commission (NPC) Guidelines
                    </p>
                </div>
            </section>

            {/* Main Policy Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-8">
                {/* Introduction Callout */}
                <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-5 sm:p-6 text-blue-100 space-y-3 shadow-lg backdrop-blur-xs">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        Provincial Government Commitment
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-200">
                        The <strong>Provincial Government of Davao del Sur</strong> values the privacy and security of all government personnel, procurement practitioners, reviewing officers, and system users. This policy explains how we collect, safeguard, process, and retain your data when accessing the <strong>E-Procurement PPMP/APP System</strong>.
                    </p>
                </div>

                {/* Section 1: Scope & Legal Basis */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            1
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Legal Basis & Regulatory Framework
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>
                            This system operates strictly under the legal mandates governing Philippine public procurement and data protection:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                            <li><strong>Republic Act No. 10173</strong> (Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR).</li>
                            <li><strong>Republic Act No. 12009</strong> (New Government Procurement Act - NGPA) and its Implementing Rules and Regulations.</li>
                            <li><strong>Executive Order No. 2 (s. 2016)</strong> on Freedom of Information in the Executive Branch.</li>
                            <li>Internal provincial procurement guidelines, auditing regulations of the Commission on Audit (COA), and the Department of the Interior and Local Government (DILG).</li>
                        </ul>
                    </div>
                </div>

                {/* Section 2: Information Collected */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            2
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Personal & Official Information We Collect
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 pl-1">
                        <p>
                            When registering an authorized account or interacting with the e-procurement platform, the system collects necessary personal and organizational data:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5" /> User Identification
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Full Name, official email address, contact/mobile telephone number, and user address.
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Building className="w-3.5 h-3.5" /> Administrative Assignment
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Implementing office, department or unit assignment, official position, government role (End-User, Head, Budget, OPPMO, TWG, BAC).
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" /> Digital Specimen Signature
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Electronic or drawn specimen signature affixed onto official Project Procurement Management Plans (PPMPs) and Annual Procurement Plans (APPs).
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5" /> Security & Audit Logs
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Encrypted authentication credentials, timestamped login attempts, IP addresses, document review timestamps, and system audit trail events.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Purpose & Processing */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            3
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Purpose and Lawful Basis of Processing
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>All data collected is used solely for legitimate provincial government operations:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300">
                            <li><strong>Workflow Routing & Approval:</strong> Enabling multi-level review and sign-off processes among Office Heads, Provincial Budget Office, OPPMO, and TWG.</li>
                            <li><strong>Official Document Generation:</strong> Rendering standardized printable PPMP matrices, attachment lists, and the Province Annual Procurement Plan (APP) submitted for Governor approval.</li>
                            <li><strong>Accountability & Audit Trails:</strong> Preserving immutable logs of approvals, returns, edits, and receipts for COA compliance and official accountability.</li>
                            <li><strong>Access Security:</strong> Validating user privileges and preventing unauthorized access or document tampering.</li>
                        </ul>
                    </div>
                </div>

                {/* Section 4: Data Sharing, Storage & Retention */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            4
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Data Storage, Protection & Retention
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>
                            Your information is stored securely on authorized provincial infrastructure:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300">
                            <li><strong>Encryption & Protection:</strong> Sensitive information including passwords and digital signatures are stored using industry-standard hashing and encryption protocols.</li>
                            <li><strong>No Commercial Disclosure:</strong> The Provincial Government does not sell, rent, or trade your personal information to third parties or commercial entities.</li>
                            <li><strong>Retention Period:</strong> Procurement records and associated personnel signatures are retained according to the National Archives of the Philippines (NAP) General Records Disposition Schedule and COA retention policies.</li>
                        </ul>
                    </div>
                </div>

                {/* Section 5: Data Subject Rights */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            5
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Your Rights Under the Data Privacy Act
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>Under Republic Act No. 10173, as a data subject you have the right to:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to be Informed</strong>
                                    <span className="text-xs text-slate-400">Know how your data is being collected and processed.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to Access</strong>
                                    <span className="text-xs text-slate-400">View your profile and the documents you have initiated or reviewed.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to Rectification</strong>
                                    <span className="text-xs text-slate-400">Request correction of inaccurate or outdated official information.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to File Complaint</strong>
                                    <span className="text-xs text-slate-400">Raise privacy concerns directly with the Provincial Data Protection Officer or NPC.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 6: Contact & Inquiries */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-sm">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                        <Building className="w-4 h-4 text-blue-400" />
                        Provincial Data Protection Contact Information
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        For any inquiries, requests for clarification, or questions regarding this Privacy Policy and your rights under the Data Privacy Act of 2012, please reach out to:
                    </p>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
                        <div className="text-white font-bold">OFFICE OF THE PROVINCIAL PROCUREMENT MANAGEMENT OFFICER (OPPMO)</div>
                        <div>Provincial Capitol Complex, Matti, Digos City, Davao del Sur</div>
                        <div>Province of Davao del Sur, Philippines</div>
                        <div className="text-blue-400 pt-1">Email: oppmo@davaodelsur.gov.ph</div>
                    </div>
                </div>

                {/* Return Action */}
                {onBack && (
                    <div className="text-center pt-4 pb-8">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return to Login / Sign In
                        </button>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 bg-slate-950">
                <p>&copy; {new Date().getFullYear()} Province of Davao del Sur. All Rights Reserved.</p>
                <p className="text-[11px] text-slate-600 mt-1">E-Procurement PPMP/APP System &bull; Republic of the Philippines</p>
            </footer>
        </div>
    );
};
