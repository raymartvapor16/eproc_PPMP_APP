import React, { useState, useMemo, useEffect } from 'react';
import {
    Bell,
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Eye,
    Check,
    RotateCcw,
    Sparkles,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Clock,
    FileSpreadsheet,
} from 'lucide-react';
import { StatusBadge, formatCurrency } from '../UI/StatusBadge';
import { PimsPublishModal } from '../Monitoring/PimsPublishModal';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parses month and year from a start_date string (e.g., "2026-08", "8/2026", "August 2026", "2026-08 - 2026-09").
 */
export const parseStartMonthYear = (startDateStr) => {
    if (!startDateStr) return null;
    const str = String(startDateStr).trim();
    if (!str) return null;

    // Take the start part if it's a range
    const cleanStr = str.split(' - ')[0].split(' to ')[0].trim();

    // 1. Try ISO format: "2026-08" or "2026-08-15"
    const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        if (month >= 1 && month <= 12) {
            return { month, year, monthName: MONTH_NAMES[month - 1] };
        }
    }

    // 2. Try MM/YYYY or M/YYYY
    const slashMatch = cleanStr.match(/^(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const month = parseInt(slashMatch[1], 10);
        const year = parseInt(slashMatch[2], 10);
        if (month >= 1 && month <= 12) {
            return { month, year, monthName: MONTH_NAMES[month - 1] };
        }
    }

    // 3. Try textual month name: "August 2026" or "August"
    for (let i = 0; i < MONTH_NAMES.length; i++) {
        const mName = MONTH_NAMES[i];
        if (cleanStr.toLowerCase().includes(mName.toLowerCase())) {
            const yearMatch = cleanStr.match(/\b(20\d\d)\b/);
            const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
            return { month: i + 1, year, monthName: mName };
        }
    }

    return null;
};

/**
 * Extracts all Start of Procurement Activity schedules from a PPMP's items.
 */
export const getPpmpStartOfActivity = (ppmp) => {
    const items = ppmp?.items || [];
    const valid = [];

    items.forEach((item) => {
        if (!item.is_header && item.start_date) {
            const parsed = parseStartMonthYear(item.start_date);
            if (parsed) {
                valid.push({
                    ...parsed,
                    raw: item.start_date,
                    itemDescription: item.description,
                });
            }
        }
    });

    if (valid.length === 0) return null;

    // Sort by earliest scheduled month/year
    valid.sort((a, b) => a.year - b.year || a.month - b.month);

    // Group unique month-years for display
    const uniqueMonthYears = [];
    const seen = new Set();
    valid.forEach((v) => {
        const key = `${v.month}-${v.year}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueMonthYears.push(v);
        }
    });

    return {
        primary: valid[0],
        allSchedules: uniqueMonthYears,
        summaryLabel: uniqueMonthYears.map((u) => `${u.monthName} ${u.year}`).join(', '),
    };
};

/**
 * Calculates reminder urgency and message based on the current date and scheduled activity month.
 */
export const getPimsReminderInfo = (startSchedule, customDate = null) => {
    if (!startSchedule || !startSchedule.primary) return null;

    const now = customDate ? new Date(customDate) : new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysLeftInMonth = lastDayOfMonth - currentDay;

    // "Nearly the end of the month": Day 20 onwards or <= 10 days remaining
    const isNearEndOfMonth = currentDay >= 20 || daysLeftInMonth <= 10;

    const targetYear = startSchedule.primary.year;
    const targetMonth = startSchedule.primary.month;
    const monthName = startSchedule.primary.monthName;

    const isSameYear = currentYear === targetYear;
    const isSameMonth = isSameYear && currentMonth === targetMonth;
    const isMonthBefore = isSameYear && currentMonth === targetMonth - 1;
    const isPastTarget = currentYear > targetYear || (isSameYear && currentMonth > targetMonth);

    // 1. High-priority URGENT: Nearly end of month during the target month OR month before
    if ((isSameMonth || isMonthBefore) && isNearEndOfMonth) {
        return {
            isUrgent: true,
            isNearEnd: true,
            level: 'URGENT',
            badgeText: 'Nearly End of Month',
            daysLeft: daysLeftInMonth,
            monthName,
            title: `Nearly End of the Month — Publish PPMP to PIMS!`,
            message: `Start of Procurement Activity is scheduled for ${monthName} ${targetYear}. With ${daysLeftInMonth} day${daysLeftInMonth === 1 ? '' : 's'} remaining this month, please publish this PPMP on the PIMS system immediately so procurement can proceed on schedule.`,
        };
    }

    // 2. Target Month Active (earlier in the month)
    if (isSameMonth) {
        return {
            isUrgent: false,
            isNearEnd: false,
            level: 'ACTIVE_MONTH',
            badgeText: 'Active Procurement Month',
            daysLeft: daysLeftInMonth,
            monthName,
            title: `Procurement Month is Here (${monthName} ${targetYear})`,
            message: `Start of Procurement Activity is scheduled for this month (${monthName}). Please ensure this PPMP is published on the PIMS system before the end of the month.`,
        };
    }

    // 3. Month Overdue / Past Target
    if (isPastTarget) {
        return {
            isUrgent: true,
            isNearEnd: isNearEndOfMonth,
            level: 'OVERDUE',
            badgeText: 'Activity Month Elapsed',
            daysLeft: daysLeftInMonth,
            monthName,
            title: `Procurement Start Month has Arrived (${monthName} ${targetYear})`,
            message: `The scheduled Start of Procurement Activity was ${monthName} ${targetYear}. If you have not yet published this PPMP on the PIMS system, please do so as soon as possible.`,
        };
    }

    // 4. Upcoming Next Month (earlier in month before)
    if (isMonthBefore) {
        return {
            isUrgent: false,
            isNearEnd: false,
            level: 'UPCOMING_SOON',
            badgeText: 'Upcoming Next Month',
            daysLeft: daysLeftInMonth,
            monthName,
            title: `Procurement Starts Next Month (${monthName} ${targetYear})`,
            message: `Start of Procurement Activity begins next month in ${monthName}. Plan ahead to publish this PPMP to the PIMS system before the end of the month.`,
        };
    }

    // 5. Future Scheduled
    return {
        isUrgent: false,
        isNearEnd: false,
        level: 'SCHEDULED',
        badgeText: `Scheduled: ${monthName} ${targetYear}`,
        daysLeft: daysLeftInMonth,
        monthName,
        title: `Scheduled for ${monthName} ${targetYear}`,
        message: `Procurement activity is planned for ${monthName} ${targetYear}. You will be reminded near the end of the month to publish this PPMP on the PIMS system.`,
    };
};

/**
 * PimsPublishReminderCard:
 * Displayed on the End User Dashboard to remind users when a PPMP's Start of Procurement Activity
 * is scheduled and nearing the end of the month, prompting them to publish the PPMP to PIMS.
 */
export const PimsPublishReminderCard = ({ ppmps = [], onOpenPpmp }) => {
    const [publishedMap, setPublishedMap] = useState(() => {
        try {
            const stored = localStorage.getItem('pims_published_ppmps');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'urgent' | 'published'
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [selectedPpmpForPublish, setSelectedPpmpForPublish] = useState(null);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

    // Sync published map across events
    useEffect(() => {
        const handleSync = () => {
            try {
                const stored = localStorage.getItem('pims_published_ppmps');
                if (stored) setPublishedMap(JSON.parse(stored));
            } catch (e) {}
        };
        window.addEventListener('pims:published', handleSync);
        window.addEventListener('monitoring:updated', handleSync);
        return () => {
            window.removeEventListener('pims:published', handleSync);
            window.removeEventListener('monitoring:updated', handleSync);
        };
    }, []);

    const handlePublishClick = (ppmp) => {
        if (publishedMap[ppmp.uuid]) {
            // Unmark published PPMP
            setPublishedMap((prev) => {
                const next = { ...prev };
                delete next[ppmp.uuid];
                try {
                    localStorage.setItem('pims_published_ppmps', JSON.stringify(next));
                } catch (err) {
                    console.error('Failed to save to localStorage', err);
                }
                return next;
            });
        } else {
            // Prompt modal to capture what enduser is procuring and start monitoring
            setSelectedPpmpForPublish(ppmp);
            setIsPublishModalOpen(true);
        }
    };

    // Calculate reminders for all PPMPs with a Start of Procurement Activity in any workflow status
    const reminderItems = useMemo(() => {
        const list = [];

        (ppmps || []).forEach((ppmp) => {
            const schedule = getPpmpStartOfActivity(ppmp);
            if (!schedule) return;

            const reminderInfo = getPimsReminderInfo(schedule);
            const isPublished = Boolean(publishedMap[ppmp.uuid]);

            list.push({
                ppmp,
                schedule,
                reminderInfo,
                isPublished,
                publishedAt: publishedMap[ppmp.uuid]?.publishedAt || null,
            });
        });

        // Sort: Urgent first, then by earliest activity date
        list.sort((a, b) => {
            if (a.isPublished !== b.isPublished) return a.isPublished ? 1 : -1;
            if (a.reminderInfo.isUrgent !== b.reminderInfo.isUrgent) {
                return a.reminderInfo.isUrgent ? -1 : 1;
            }
            return (
                a.schedule.primary.year - b.schedule.primary.year ||
                a.schedule.primary.month - b.schedule.primary.month
            );
        });

        return list;
    }, [ppmps, publishedMap]);

    const urgentCount = reminderItems.filter((i) => !i.isPublished && i.reminderInfo.isUrgent).length;
    const pendingCount = reminderItems.filter((i) => !i.isPublished).length;
    const publishedCount = reminderItems.filter((i) => i.isPublished).length;

    // Current month info
    const now = new Date();
    const currentMonthName = MONTH_NAMES[now.getMonth()];
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const isCurrentNearEnd = now.getDate() >= 20 || daysRemaining <= 10;

    // Filter displayed list based on active tab
    const displayedItems = useMemo(() => {
        if (activeTab === 'urgent') {
            return reminderItems.filter((i) => !i.isPublished && i.reminderInfo.isUrgent);
        }
        if (activeTab === 'published') {
            return reminderItems.filter((i) => i.isPublished);
        }
        // Default: Pending reminders
        return reminderItems.filter((i) => !i.isPublished);
    }, [reminderItems, activeTab]);

    if (reminderItems.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200">
            {/* Header Banner */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                        <Bell className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide flex items-center gap-2 text-white">
                                PIMS Publishing Reminder Center
                            </h2>
                            {urgentCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white shadow-xs animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    {urgentCount} Urgent Action Required
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30 font-mono">
                                    {pendingCount} Active Procurement Reminders
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                            Official reminder to publish approved and scheduled PPMPs onto the{' '}
                            <strong className="text-amber-300 font-semibold">PIMS system</strong> before or near the end of the month based on the{' '}
                            <span className="text-slate-100 font-medium">Start of Procurement Activity</span>.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <div className="hidden lg:flex flex-col items-end text-right text-xs pr-2 border-r border-slate-700/60">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Current Cycle</span>
                        <span className="font-semibold text-amber-300 font-mono">
                            {currentMonthName} {now.getFullYear()}
                        </span>
                        <span className="text-[10px] text-slate-300">
                            {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left {isCurrentNearEnd && '(Near End)'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-slate-700"
                    >
                        {isCollapsed ? (
                            <>
                                <span>Show Reminders ({displayedItems.length})</span>
                                <ChevronDown className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                <span>Minimize</span>
                                <ChevronUp className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    {/* Navigation Tabs Bar */}
                    <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-200 bg-slate-50/70 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('pending')}
                                className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                    activeTab === 'pending'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Pending to Publish
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                    {pendingCount}
                                </span>
                            </button>

                            {urgentCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('urgent')}
                                    className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                        activeTab === 'urgent'
                                            ? 'border-rose-600 text-rose-600'
                                            : 'border-transparent text-rose-600 hover:text-rose-800'
                                    }`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Urgent (End of Month)
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 animate-pulse">
                                        {urgentCount}
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setActiveTab('published')}
                                className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                    activeTab === 'published'
                                        ? 'border-emerald-600 text-emerald-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Published on PIMS
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {publishedCount}
                                </span>
                            </button>
                        </div>

                        <div className="text-[11px] text-slate-500 pb-2 italic">
                            Applies to all PPMPs regardless of review status
                        </div>
                    </div>

                    {/* Reminders List */}
                    <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                        {displayedItems.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50/50">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    {activeTab === 'published'
                                        ? 'No PPMPs Marked as Published Yet'
                                        : 'All Scheduled PPMPs are Up to Date!'}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    {activeTab === 'published'
                                        ? 'Click "Mark as Published to PIMS" on any reminder to track your PIMS publishing progress.'
                                        : 'No pending end-of-month procurement publications require your attention at this time.'}
                                </p>
                            </div>
                        ) : (
                            displayedItems.map(({ ppmp, schedule, reminderInfo, isPublished, publishedAt }) => {
                                const isUrgent = reminderInfo.isUrgent && !isPublished;

                                return (
                                    <div
                                        key={ppmp.id}
                                        className={`p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                            isPublished
                                                ? 'bg-slate-50/40 hover:bg-slate-50'
                                                : isUrgent
                                                ? 'bg-amber-50/60 hover:bg-amber-50 border-l-4 border-amber-500'
                                                : 'hover:bg-slate-50/80 border-l-4 border-blue-500'
                                        }`}
                                    >
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            {/* Top badges */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                    {ppmp.tracking_number || ppmp.ppmp_number || 'PPMP'}
                                                </span>

                                                <StatusBadge status={ppmp.status} />

                                                {/* Start of Activity Badge */}
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                                                    <Calendar className="w-3 h-3 text-indigo-700" />
                                                    Start of Activity: {schedule.summaryLabel}
                                                </span>

                                                {/* Urgency Badge */}
                                                {!isPublished && (
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                                            isUrgent
                                                                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                        }`}
                                                    >
                                                        {isUrgent ? <AlertTriangle className="w-3 h-3 text-rose-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                                                        {reminderInfo.badgeText}
                                                    </span>
                                                )}

                                                {isPublished && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        Published to PIMS
                                                    </span>
                                                )}
                                            </div>

                                            {/* Project Title */}
                                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={ppmp.title}>
                                                {ppmp.title}
                                            </h3>

                                            {/* Reminder Notification Box */}
                                            <div
                                                className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                                                    isPublished
                                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                                        : isUrgent
                                                        ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-medium'
                                                        : 'bg-blue-50/70 border-blue-200 text-blue-900'
                                                }`}
                                            >
                                                {isPublished ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                ) : isUrgent ? (
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                ) : (
                                                    <Bell className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                                )}

                                                <div>
                                                    <div className="font-bold text-[11px] uppercase tracking-wide">
                                                        {isPublished ? 'Publication Recorded' : reminderInfo.title}
                                                    </div>
                                                    <div className="text-[11px] mt-0.5 leading-snug">
                                                        {isPublished ? (
                                                            <span>
                                                                This PPMP has been marked as published to the PIMS system.
                                                                {publishedAt && ` (Recorded: ${new Date(publishedAt).toLocaleDateString()})`}
                                                            </span>
                                                        ) : (
                                                            reminderInfo.message
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Budget</span>
                                                <span className="font-mono text-xs font-bold text-slate-800">
                                                    {formatCurrency(ppmp.total_budget)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPpmp(ppmp.uuid)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-2xs"
                                                    title="View PPMP details and items"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> View
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handlePublishClick(ppmp)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-2xs ${
                                                        isPublished
                                                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                    }`}
                                                    title={
                                                        isPublished
                                                            ? 'Click to unmark as published'
                                                            : 'Confirm that this PPMP has been published to the PIMS system'
                                                    }
                                                >
                                                    {isPublished ? (
                                                        <>
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            <span>Unmark</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>Publish Done</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            <PimsPublishModal
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                ppmp={selectedPpmpForPublish}
                onSuccess={() => {
                    try {
                        const stored = localStorage.getItem('pims_published_ppmps');
                        if (stored) setPublishedMap(JSON.parse(stored));
                    } catch (e) {}
                }}
            />
        </div>
    );
};
