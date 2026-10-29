import React, { useState, useEffect } from 'react';
import {
    X,
    Building2,
    Calendar,
    Layers,
    Banknote,
    FileText,
    User,
    Plus,
    History,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Shield,
    Sparkles,
    ArrowRight,
    Award,
    Printer,
    FileSpreadsheet,
    GitBranch,
    GitMerge,
    Eye
} from 'lucide-react';
import { MonitoringStepItem } from './MonitoringStepItem';
import { AddStepModal } from './AddStepModal';
import { monitoringService } from '../../services/api';
import { formatCurrency } from '../UI/StatusBadge';

export const MonitoringProjectDetailModal = ({
    isOpen,
    onClose,
    projectId,
    user,
    canManage = true,
    onProjectUpdated,
}) => {
    if (!isOpen || !projectId) return null;

    // Only OPPMO Monitors and Admins can manage monitoring projects and steps.
    // End-users, Office Heads, and Reviewers (Budget Officer, TWG, PACCO, etc.) are view-only.
    const isManageable = Boolean(
        canManage &&
        user &&
        ['super_admin', 'admin', 'monitor', 'oppmo'].includes(user.role)
    );

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeDivision, setActiveDivision] = useState('pr_division'); // pr_division, technical_division, bac_support_division, contracting_division, history
    const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);

    // PIMS PR ID state & handler
    const [isEditingPrId, setIsEditingPrId] = useState(false);
    const [prIdInput, setPrIdInput] = useState('');
    const [savingPrId, setSavingPrId] = useState(false);
    const [prIdError, setPrIdError] = useState(null);

    useEffect(() => {
        if (project) {
            setPrIdInput(project.pims_pr_id || '');
        }
    }, [project?.pims_pr_id]);

    const handleSavePrId = async (e) => {
        if (e) e.preventDefault();
        const val = prIdInput.trim();
        if (!val) {
            setPrIdError('Please enter a valid PR ID');
            return;
        }

        setSavingPrId(true);
        setPrIdError(null);
        try {
            await monitoringService.updatePrId(project.id, val);
            const updated = { ...project, pims_pr_id: val };
            setProject(updated);
            setIsEditingPrId(false);
            if (onProjectUpdated) onProjectUpdated(updated);
        } catch (err) {
            console.error('Failed to update PIMS PR ID in modal:', err);
            setPrIdError(err.response?.data?.message || 'Failed to update PR ID');
        } finally {
            setSavingPrId(false);
        }
    };

    const loadProject = async () => {
        setLoading(true);
        try {
            const res = await monitoringService.getProject(projectId);
            setProject(res.data.project);
        } catch (err) {
            console.error(err);
            alert('Failed to load project details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProject();
    }, [projectId]);

    const handleStepUpdated = (updatedProject) => {
        setProject(updatedProject);
        if (onProjectUpdated) onProjectUpdated(updatedProject);
    };

    if (loading || !project) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="text-sm font-bold text-slate-800">Loading Procurement Monitoring Details...</div>
                </div>
            </div>
        );
    }

    const steps = project.steps || [];
    const prSteps = steps.filter((s) => s.division === 'pr_division');
    const techSteps = steps.filter((s) => s.division === 'technical_division');
    const bacSteps = steps.filter((s) => s.division === 'bac_support_division');
    const contractingSteps = steps.filter((s) => s.division === 'contracting_division');

    const getDivisionSteps = (division) => {
        switch (division) {
            case 'pr_division': return prSteps;
            case 'technical_division': return techSteps;
            case 'bac_support_division': return bacSteps;
            case 'contracting_division': return contractingSteps;
            default: return [];
        }
    };

    const isCbMode = project.procurement_mode === 'CB' || project.procurement_mode?.toLowerCase().includes('competitive');

    // Calculate division progress percentage
    const calcProgress = (stepList) => {
        if (!stepList.length) return 0;
        const done = stepList.filter((s) => s.status === 'COMPLETED' || s.status === 'APPROVED').length;
        return Math.round((done / stepList.length) * 100);
    };

    const totalDone = steps.filter((s) => s.status === 'COMPLETED' || s.status === 'APPROVED').length;
    const overallProgress = steps.length ? Math.round((totalDone / steps.length) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header Banner */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                                        project.category === 'INFRA'
                                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                            : 'bg-blue-400/20 text-blue-300 border-blue-400/40'
                                    }`}
                                >
                                    {project.category === 'INFRA' ? 'Infrastructure (INFRA)' : 'Goods & Consulting Services'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white border border-white/20">
                                    Mode: {project.procurement_mode}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    {project.status}
                                </span>
                                {!isManageable && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700/80 text-slate-300 border border-slate-600 flex items-center gap-1 shadow-xs">
                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                        <span>View Only</span>
                                    </span>
                                )}
                                {project.amendment_badge && (
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider border flex items-center gap-1 shadow-xs ${
                                            project.is_supplemental
                                                ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                                                : 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                        }`}
                                    >
                                        <GitBranch className="w-3.5 h-3.5" />
                                        <span>{project.amendment_badge}</span>
                                    </span>
                                )}
                            </div>

                            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight line-clamp-2">
                                {project.project_title}
                            </h2>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-blue-200/90 pt-1">
                                {project.pr_number && (
                                    <span className="flex items-center gap-1">
                                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                                        <span>PPMP / Tracker No: <strong className="text-white font-mono">{project.pr_number}</strong></span>
                                    </span>
                                )}
                                {project.pims_pr_id && !isEditingPrId && (
                                    <span className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 rounded-lg text-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        <span>PIMS PR ID: <strong className="text-white font-mono">{project.pims_pr_id}</strong></span>
                                        {isManageable && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditingPrId(true);
                                                    setPrIdInput(project.pims_pr_id);
                                                }}
                                                className="text-[10px] text-emerald-300 hover:text-white underline ml-1 cursor-pointer font-bold"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </span>
                                )}
                                {!project.pims_pr_id && (
                                    <span className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 rounded-lg text-slate-300">
                                        <span>PIMS PR ID: <strong className="text-slate-400 font-mono italic">Not assigned</strong></span>
                                    </span>
                                )}
                                {project.abc_amount && (
                                    <span className="flex items-center gap-1">
                                        <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>ABC: <strong className="text-emerald-300 font-mono">{formatCurrency(project.abc_amount)}</strong></span>
                                    </span>
                                )}
                                {(project.implementing_unit || project.office?.name) && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Unit: <strong className="text-white">{project.implementing_unit || project.office?.name}</strong></span>
                                    </span>
                                )}
                                {project.end_user_name && (
                                    <span className="flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 text-blue-400" />
                                        <span>End-User: <strong className="text-white">{project.end_user_name}</strong></span>
                                    </span>
                                )}
                                {project.pims_published_at && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                        <span>PIMS Published: <strong className="text-white">{new Date(project.pims_published_at).toLocaleDateString()}</strong></span>
                                    </span>
                                )}
                            </div>

                            {/* Linked Tracker PPMP Versions (Amended / Supplemental) */}
                            {project.amendment_history && project.amendment_history.length > 1 && (
                                <div className="mt-2.5 p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs text-purple-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 font-bold text-purple-200">
                                            <GitMerge className="w-4 h-4 text-purple-400" />
                                            <span>Merged Tracker PPMP Revisions ({project.pr_number})</span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40">
                                            {project.amendment_history.length} Versions Merged
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {project.amendment_history.map((rev) => (
                                            <div
                                                key={rev.id}
                                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition ${
                                                    rev.is_current
                                                        ? 'bg-purple-900/60 border-purple-400 text-white font-semibold shadow-xs'
                                                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                                                }`}
                                            >
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <span>{rev.version_label}</span>
                                                        {rev.is_current && (
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                                                                Active In Workflow
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Budget: {formatCurrency(rev.total_budget)}
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    rev.is_current ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {rev.status?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Prompt to input PIMS PR ID if missing or editing */}
                            {isManageable && (!project.pims_pr_id || isEditingPrId) && (
                                <div className="mt-3 p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 flex flex-wrap items-center justify-between gap-3 text-amber-200">
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                                        <div>
                                            <span className="font-bold text-amber-300">
                                                {project.pims_pr_id ? 'Update PIMS PR ID:' : 'PIMS PR ID Required:'}
                                            </span>{' '}
                                            <span>Enter the Purchase Request ID from the Provincial PIMS system.</span>
                                        </div>
                                    </div>
                                    <form onSubmit={handleSavePrId} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={prIdInput}
                                            onChange={(e) => setPrIdInput(e.target.value)}
                                            placeholder="e.g. PR-2026-10-042"
                                            style={{ color: '#000000' }}
                                            className="px-3 py-1.5 text-xs bg-white text-black font-bold rounded-lg border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-500 w-48 sm:w-60 shadow-inner"
                                        />
                                        <button
                                            type="submit"
                                            disabled={savingPrId || !prIdInput.trim()}
                                            className="px-3.5 py-1.5 text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer shadow-md"
                                        >
                                            {savingPrId ? 'Saving...' : 'Save PR ID'}
                                        </button>
                                        {isEditingPrId && project.pims_pr_id && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditingPrId(false);
                                                    setPrIdInput(project.pims_pr_id || '');
                                                }}
                                                className="px-2 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </form>
                                    {prIdError && (
                                        <p className="w-full text-xs text-red-300 font-medium">{prIdError}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-4">
                        <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-300"
                                style={{ width: `${overallProgress}%` }}
                            />
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-300 shrink-0">
                            {overallProgress}% OPPMO Pipeline Complete
                        </div>
                    </div>
                </div>

                {/* Division Stage Tabs */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between overflow-x-auto shrink-0 gap-2">
                    <div className="flex items-center gap-1 py-2">
                        {/* 1. PR Division */}
                        <button
                            type="button"
                            onClick={() => setActiveDivision('pr_division')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeDivision === 'pr_division'
                                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] flex items-center justify-center font-bold">1</span>
                            <span>PR Division</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {calcProgress(prSteps)}%
                            </span>
                        </button>

                        {/* 2. Technical Division */}
                        <button
                            type="button"
                            onClick={() => setActiveDivision('technical_division')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeDivision === 'technical_division'
                                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] flex items-center justify-center font-bold">2</span>
                            <span>Technical Division</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {calcProgress(techSteps)}%
                            </span>
                        </button>

                        {/* 3. BAC Support Division */}
                        <button
                            type="button"
                            onClick={() => setActiveDivision('bac_support_division')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeDivision === 'bac_support_division'
                                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 text-[10px] flex items-center justify-center font-bold">3</span>
                            <span>BAC Support Division</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {calcProgress(bacSteps)}%
                            </span>
                        </button>

                        {/* 4. Contracting Division */}
                        <button
                            type="button"
                            onClick={() => setActiveDivision('contracting_division')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                                activeDivision === 'contracting_division'
                                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px] flex items-center justify-center font-bold">4</span>
                            <span>Contracting Division</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {calcProgress(contractingSteps)}%
                            </span>
                        </button>

                        {/* History Log */}
                        <button
                            type="button"
                            onClick={() => setActiveDivision('history')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                activeDivision === 'history'
                                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                            }`}
                        >
                            <History className="w-3.5 h-3.5" />
                            <span>Timeline History</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {project.histories?.length || 0}
                            </span>
                        </button>
                    </div>

                    {activeDivision !== 'history' && isManageable && (
                        <button
                            type="button"
                            onClick={() => setIsAddStepModalOpen(true)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                            title="Add a custom step to this division"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Step</span>
                        </button>
                    )}
                </div>

                {/* Division Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    {activeDivision === 'pr_division' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900">
                                <h4 className="font-bold text-blue-950 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-blue-600" />
                                    PR Division Workflow Process
                                </h4>
                                <p className="mt-0.5 text-blue-800">
                                    Monitor create & publish to PIMS → Release PR to end-user → Receive PR docs from end-user → Review PR (Approve / Suspend if compliance needed) → Release to Technical Division.
                                </p>
                            </div>

                            <div className="mt-2">
                                {prSteps.map((step, idx) => (
                                    <MonitoringStepItem
                                        key={step.id}
                                        step={step}
                                        index={idx}
                                        projectId={project.id}
                                        canManage={isManageable}
                                        onStepUpdated={handleStepUpdated}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeDivision === 'technical_division' && (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950">
                                <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                    Technical Division Workflow ({project.procurement_mode} Mode)
                                </h4>
                                <p className="mt-0.5 text-indigo-800">
                                    {isCbMode ? (
                                        <>
                                            <strong>Competitive Bidding (CB) Mode: </strong>
                                            Pre-procurement review, PhilGEPS posting, pre-bid conference, TWG evaluation, and release to end-user.
                                            <span className="block mt-1 font-bold text-indigo-900 bg-white/70 p-1.5 rounded-md border border-indigo-200">
                                                ★ Note: For CB mode only Miss Sharia release the documents.
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <strong>Small Value Procurement (SVP) Mode: </strong>
                                            Canvass preparation, distribution of RFQs, quotation abstract, technical evaluation, and release to end-user.
                                        </>
                                    )}
                                </p>
                            </div>

                            <div className="mt-2">
                                {techSteps.map((step, idx) => (
                                    <MonitoringStepItem
                                        key={step.id}
                                        step={step}
                                        index={idx}
                                        projectId={project.id}
                                        canManage={isManageable}
                                        isTechnicalCb={isCbMode && idx === techSteps.length - 1}
                                        onStepUpdated={handleStepUpdated}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeDivision === 'bac_support_division' && (
                        <div className="space-y-4">
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 text-xs text-teal-950">
                                <h4 className="font-bold text-teal-950 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-teal-600" />
                                    BAC Support Division Workflow & Decision Making
                                </h4>
                                <p className="mt-0.5 text-teal-800">
                                    Dropping documents by end-user → Opening during BAC meeting & release to TWG → Decision Making (Awarded vs Re-canvass: 1st opening re-canvass, 2nd opening For mandatory, 3rd opening returned to End-user) → Receive from TWG (if awarded) → Transmit to Contracting Division.
                                </p>
                            </div>

                            <div className="mt-2">
                                {bacSteps.map((step, idx) => {
                                    const isDecisionStep = step.step_name.toLowerCase().includes('decision');
                                    return (
                                        <MonitoringStepItem
                                            key={step.id}
                                            step={step}
                                            index={idx}
                                            projectId={project.id}
                                            canManage={isManageable}
                                            isBacDecision={isDecisionStep}
                                            onStepUpdated={handleStepUpdated}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeDivision === 'contracting_division' && (
                        <div className="space-y-4">
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-950">
                                <h4 className="font-bold text-purple-950 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    Contracting Division Workflow Process
                                </h4>
                                <p className="mt-0.5 text-purple-800">
                                    Receipt of folder from BAC Support → Notice of Award (NOA) → Contract / PO drafting & approval → Notice to Proceed (NTP) → Delivery & inspection monitoring.
                                </p>
                            </div>

                            <div className="mt-2">
                                {contractingSteps.map((step, idx) => (
                                    <MonitoringStepItem
                                        key={step.id}
                                        step={step}
                                        index={idx}
                                        projectId={project.id}
                                        canManage={isManageable}
                                        onStepUpdated={handleStepUpdated}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {activeDivision === 'history' && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-500" />
                                Timeline History & Audit Trail of OPPMO Office
                            </h4>

                            {(!project.histories || project.histories.length === 0) ? (
                                <div className="text-center py-8 text-xs text-slate-500">
                                    No history logs recorded yet.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {project.histories.map((h) => (
                                        <div
                                            key={h.id}
                                            className="bg-white rounded-xl border border-slate-200 p-3.5 text-xs shadow-2xs flex items-start gap-3"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900">
                                                        {h.description}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(h.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                                    {h.user && (
                                                        <span>Logged by: <strong>{h.user.name}</strong></span>
                                                    )}
                                                    {h.division && (
                                                        <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-medium">
                                                            {h.division.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Modal Controls */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-500">
                        OPPMO Office Procurement Monitoring • Province of Davao del Sur
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Add Step Modal */}
            <AddStepModal
                isOpen={isAddStepModalOpen}
                onClose={() => setIsAddStepModalOpen(false)}
                projectId={project.id}
                division={activeDivision === 'history' ? 'pr_division' : activeDivision}
                onSuccess={handleStepUpdated}
            />
        </div>
    );
};
