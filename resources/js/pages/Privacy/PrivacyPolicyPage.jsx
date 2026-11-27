import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2, Building, ClipboardCheck, UserCheck, Scale, FileCheck2 } from 'lucide-react';

export const PrivacyPolicyPage = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">

            <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
                <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 min-h-14 sm:h-16 py-2 sm:py-0 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] sm:text-xs font-semibold border border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                <span>Back<span className="hidden sm:inline"> to Sign In</span></span>
                            </button>
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                <img
                                    src="/images/logo.png"
                                    alt="Province of Davao del Sur Seal"
                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-sm"
                                />
                                <img
                                    src="/images/pmo.jpeg"
                                    alt="OPPMO Seal"
                                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-full border border-white/20 shadow-xs"
                                />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-[11px] sm:text-sm font-extrabold uppercase tracking-wider text-white truncate">
                                    Province of Davao del Sur
                                </h1>
                                <p className="text-[10px] text-blue-400 font-mono hidden sm:block truncate">
                                    E-Procurement &amp; Supplier Evaluation System
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center shrink-0">
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap shrink-0">
                            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                            <span>R.A. 10173<span className="hidden sm:inline"> Compliant</span></span>
                        </span>
                    </div>
                </div>
            </header>

            <section className="relative overflow-hidden py-8 sm:py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10 space-y-3">
                    <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-600/30 text-blue-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 max-w-full">
                        <Scale className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="leading-snug">Official Government Transparency &amp; Data Protection Notice</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
                        Data Privacy Policy
                    </h2>
                    <p className="text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        Notice and policy on the collection, protection, processing, and management of personal, official, and supplier evaluation data for the Province of Davao del Sur E-Procurement System (PPMP/APP, PIMS, Project Monitoring, and Supplier Evaluation System).
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-mono pt-1 leading-relaxed">
                        In Compliance with Republic Act No. 10173 (Data Privacy Act of 2012) and National Privacy Commission (NPC) Guidelines
                    </p>
                </div>
            </section>

            <main className="max-w-4xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 space-y-6 sm:space-y-8">

                <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-5 sm:p-6 text-blue-100 space-y-3 shadow-lg backdrop-blur-xs">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        Provincial Government Commitment
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-200">
                        The <strong>Provincial Government of Davao del Sur</strong> values the privacy and security of all government personnel, procurement practitioners, reviewing officers, evaluators, suppliers, and system users. This policy explains how we collect, safeguard, process, and retain your data when accessing the <strong>E-Procurement System</strong>, including the <strong>PPMP/APP</strong>, <strong>PIMS</strong>, <strong>Project Monitoring</strong>, and <strong>Supplier Evaluation System</strong> modules.
                    </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            1
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Legal Basis &amp; Regulatory Framework
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>
                            This system operates strictly under the legal mandates governing Philippine public procurement, supplier performance evaluation, and data protection:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                            <li><strong>Republic Act No. 10173</strong> (Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR).</li>
                            <li><strong>Republic Act No. 12009</strong> (New Government Procurement Act - NGPA) and its Implementing Rules and Regulations.</li>
                            <li><strong>Executive Order No. 2 (s. 2016)</strong> on Freedom of Information in the Executive Branch.</li>
                            <li><strong>GPPB &amp; Provincial Supplier Performance Evaluation Guidelines</strong> governing post-delivery vendor assessment, contract compliance, and procurement accountability.</li>
                            <li>Internal provincial procurement guidelines, auditing regulations of the Commission on Audit (COA), and the Department of the Interior and Local Government (DILG).</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            2
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Personal, Official &amp; Supplier Evaluation Information We Collect
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 pl-1">
                        <p>
                            When registering an authorized account, managing procurement plans, or conducting supplier performance evaluations, the system collects necessary personal, organizational, and procurement data:
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
                                    Implementing office, department or unit assignment, official position, and government role (End-User, Office Head, Authorized Representative, Budget, PACCO, OPPMO, TWG, BAC, Administrator).
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" /> Digital Specimen Signature
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Electronic, PNPKI, or drawn specimen signatures affixed onto official Project Procurement Management Plans (PPMPs), Annual Procurement Plans (APPs), and Supplier Performance Evaluation approvals.
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <ClipboardCheck className="w-3.5 h-3.5" /> Supplier Evaluation &amp; P.O. Records
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Supplier/company names, Purchase Order (P.O.) and Purchase Request (P.R.) numbers, covered periods (CY), evaluation dates, weighted performance ratings, evaluator remarks, and uploaded P.O. PDF documents.
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <FileCheck2 className="w-3.5 h-3.5" /> Authorization &amp; Request Records
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Office Head authorization letters/PDFs for delegated signatories, formal evaluation update or deletion requests with justifications, and digital approval timestamps.
                                </p>
                            </div>
                            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5" /> Security &amp; Audit Logs
                                </h4>
                                <p className="text-xs text-slate-400">
                                    Encrypted authentication credentials, timestamped login/logout records per system module, IP addresses, document review timestamps, and immutable system audit trail events.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

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
                        <p>All data collected is used solely for legitimate provincial government procurement and vendor governance operations:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300">
                            <li><strong>Workflow Routing &amp; Approval:</strong> Enabling multi-level review and sign-off processes among Office Heads, Authorized Representatives, Provincial Budget Office, PACCO, OPPMO, and TWG.</li>
                            <li><strong>Official Document Generation:</strong> Rendering standardized printable PPMP matrices, attachment lists, the Province Annual Procurement Plan (APP) submitted for Governor approval, and certified Supplier Evaluation Reports.</li>
                            <li><strong>Supplier Performance Evaluation &amp; Analytics:</strong> Recording objective post-delivery supplier ratings across standardized criteria (cost/price alignment, delivery timeliness, quality of goods/services, and responsiveness), verifying Office Head approvals, and compiling supplier performance analytics for procurement governance.</li>
                            <li><strong>Accountability &amp; Audit Trails:</strong> Preserving immutable logs of approvals, returns, edits, evaluation update/delete requests, and receipts across both the E-Procurement and Supplier Evaluation modules for COA compliance and official accountability.</li>
                            <li><strong>Access Security:</strong> Validating user privileges, enforcing office-level data boundaries, and preventing unauthorized access or document tampering.</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            4
                        </div>
                        <h3 className="text-base font-bold text-white uppercase tracking-wide">
                            Data Storage, Protection &amp; Retention
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2.5 pl-1">
                        <p>
                            Your information is stored securely on authorized provincial infrastructure with strict technical and organizational safeguards:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-300">
                            <li><strong>Encryption &amp; Protection:</strong> Sensitive information including passwords, session tokens, and digital signatures are protected using industry-standard hashing, TLS/HTTPS transport encryption, and encrypted database backups.</li>
                            <li><strong>Dedicated Supplier Evaluation Isolation &amp; Private Document Storage:</strong> Supplier Evaluation records are segregated in a dedicated database with strict role- and office-based access controls (End-Users and Office Heads access only their assigned office's records, while system-wide administration is restricted to authorized Administrators). Uploaded Purchase Order PDFs and Authorization Letters are stored in non-public private storage with <code className="text-blue-300 text-[11px]">no-store</code> cache protection and authenticated access checks.</li>
                            <li><strong>No Commercial Disclosure:</strong> The Provincial Government does not sell, rent, or trade personal, official, or supplier evaluation information to unauthorized third parties or commercial entities.</li>
                            <li><strong>Retention Period:</strong> Procurement records, supplier performance evaluations, Purchase Order attachments, authorization documents, and associated personnel signatures are retained according to the National Archives of the Philippines (NAP) General Records Disposition Schedule and COA retention policies.</li>
                        </ul>
                    </div>
                </div>

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
                                    <span className="text-xs text-slate-400">Know how your data and evaluation records are being collected and processed.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to Access</strong>
                                    <span className="text-xs text-slate-400">View your profile, PPMP/APP documents, and Supplier Evaluations you initiated or reviewed.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white text-xs block">Right to Rectification</strong>
                                    <span className="text-xs text-slate-400">Request correction of inaccurate or outdated official information or submit an evaluation update request.</span>
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
                        <div className="text-blue-400 pt-1">Email: bac.davaodelsur2@gmail.com </div>
                    </div>
                </div>

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

            <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 bg-slate-950">
                <p>&copy; {new Date().getFullYear()} Province of Davao del Sur. All Rights Reserved.</p>
                <p className="text-[11px] text-slate-600 mt-1">E-Procurement System (PPMP/APP &bull; PIMS &bull; Monitoring &bull; Supplier Evaluation) &bull; Republic of the Philippines</p>
            </footer>
        </div>
    );
};
