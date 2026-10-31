import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Sparkles,
  Flame,
  Play,
  Lock,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { formatDate, addDays, diffDays } from '../lib/scheduler';
import { SubjectBadge } from '../components/SubjectBadge';
import { ProgressRing } from '../components/ProgressRing';
import { RecoveryModal } from '../components/RecoveryModal';
import { WeekTimetable } from '../components/WeekTimetable';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { Seo } from '../components/Seo';
import type { Subject, Chapter, Block, FocusLog } from '../types/database';

function formatMinutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

function formatLostTime(mins: number): string {
  if (mins < 60) return `${mins}m lost`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h lost` : `${h}h ${m}m lost`;
}

export const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [focusLogs, setFocusLogs] = useState<FocusLog[]>([]);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [activePomodoroBlockId, setActivePomodoroBlockId] = useState<string | undefined>(undefined);

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [subs, chaps, blks, logs] = await Promise.all([
        dataService.getSubjects(user.id),
        dataService.getChapters(user.id),
        dataService.getBlocks(user.id),
        dataService.getFocusLogs(user.id),
      ]);

      // If no subjects found yet, we allow the dashboard to render its clean empty state
      // rather than trapping the user in a forceful redirect loop

      // Check for past blocks still marked 'scheduled' and update them to 'missed'
      const updatedBlocks = [...blks];
      const missedToUpdate: Block[] = [];

      for (let i = 0; i < updatedBlocks.length; i++) {
        const b = updatedBlocks[i];
        if (b.date < todayStr && b.status === 'scheduled') {
          b.status = 'missed';
          missedToUpdate.push(b);
        }
      }

      if (missedToUpdate.length > 0) {
        Promise.all(missedToUpdate.map((b) => dataService.updateBlockStatus(b.id, 'missed'))).catch((err) =>
          console.warn('Silent update to missed error:', err)
        );
      }

      setSubjects(subs);
      setChapters(chaps);
      setBlocks(updatedBlocks);
      setFocusLogs(logs);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, navigate, todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lookup maps
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // Today's blocks
  const todayBlocks = useMemo(() => {
    return blocks.filter((b) => b.date === todayStr);
  }, [blocks, todayStr]);

  // Focus time stats
  const { focusTodayMin, focusWeekMin } = useMemo(() => {
    let todaySec = 0;
    let weekSec = 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoIso = weekAgo.toISOString();

    focusLogs.forEach((l) => {
      if (l.session_type === 'pomodoro') {
        if (l.completed_at.startsWith(todayStr)) {
          todaySec += l.duration_sec;
        }
        if (l.completed_at >= weekAgoIso) {
          weekSec += l.duration_sec;
        }
      }
    });

    return {
      focusTodayMin: Math.round(todaySec / 60),
      focusWeekMin: Math.round(weekSec / 60),
    };
  }, [focusLogs, todayStr]);

  // Missed blocks
  const missedBlocks = useMemo(() => {
    return blocks.filter((b) => b.status === 'missed' || (b.date < todayStr && b.status === 'scheduled'));
  }, [blocks, todayStr]);

  const missedMinutes = useMemo(() => {
    return missedBlocks.reduce((sum, b) => sum + b.duration_min, 0);
  }, [missedBlocks]);

  // Syllabus overall progress calculation
  const { totalSyllabusMin, completedSyllabusMin, progressPercent } = useMemo(() => {
    const total = chapters.reduce((sum, c) => sum + c.est_min, 0);
    const completedBlocksMin = blocks
      .filter((b) => b.status === 'done')
      .reduce((sum, b) => sum + b.duration_min, 0);

    const percent = total > 0 ? Math.min(100, Math.round((completedBlocksMin / total) * 100)) : 0;
    return {
      totalSyllabusMin: total,
      completedSyllabusMin: completedBlocksMin,
      progressPercent: percent,
    };
  }, [chapters, blocks]);

  // Exam countdowns
  const examCountdowns = useMemo(() => {
    return subjects
      .filter((s) => Boolean(s.exam_date))
      .map((s) => ({
        ...s,
        daysLeft: diffDays(s.exam_date!, todayStr),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [subjects, todayStr]);

  // Toggle Done / Not yet action
  const handleToggleBlockStatus = async (block: Block, targetStatus: 'done' | 'scheduled') => {
    try {
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, status: targetStatus } : b))
      );

      await dataService.updateBlockStatus(block.id, targetStatus);

      // Check if all blocks for this chapter are done
      const chapter = chapterMap.get(block.chapter_id);
      if (chapter) {
        const remainingBlocksForChapter = blocks.filter(
          (b) => b.chapter_id === chapter.id && (b.id === block.id ? targetStatus !== 'done' : b.status !== 'done')
        );
        const allDone = remainingBlocksForChapter.length === 0 && targetStatus === 'done';
        if (allDone !== chapter.is_done) {
          await dataService.updateChapter(chapter.id, { is_done: allDone });
          setChapters((prev) =>
            prev.map((c) => (c.id === chapter.id ? { ...c, is_done: allDone } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to update block status:', err);
      loadData();
    }
  };

  // Lock / Unlock block
  const handleToggleLockBlock = async (block: Block) => {
    try {
      const newLocked = !block.is_locked;
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, is_locked: newLocked } : b))
      );
      await dataService.updateBlock(block.id, { is_locked: newLocked });
    } catch (err) {
      console.error('Failed to toggle block lock:', err);
    }
  };

  // Move block to tomorrow
  const handleMoveBlockToTomorrow = async (block: Block) => {
    try {
      const nextDate = addDays(block.date, 1);
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, date: nextDate } : b))
      );
      await dataService.updateBlock(block.id, { date: nextDate });
    } catch (err) {
      console.error('Failed to move block:', err);
    }
  };

  const handleApplyRecovery = async (newBlocks: Omit<Block, 'id' | 'created_at'>[]) => {
    if (!user) return;
    await dataService.replaceIncompleteBlocks(user.id, todayStr, newBlocks);
    await loadData();
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-muted mt-3">Loading your daily focus...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <Seo
        title="Dashboard — Today's Focus"
        description="View your realistic daily study blocks, visual timetable, and exam countdowns."
        noIndex={true}
        canonicalPath="/app"
      />

      {/* Greeting Header & Focus Highlights */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Today&apos;s Focus
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            {profile?.college ? `${profile.college} · ` : ''}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Live Focus Logs Stats */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs">
            <Flame className="w-4 h-4 text-primary" />
            <div>
              <span className="text-muted block text-[10px]">Today&apos;s Focus</span>
              <span className="font-bold text-ink">{focusTodayMin} mins</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs">
            <TrendingUp className="w-4 h-4 text-mint" />
            <div>
              <span className="text-muted block text-[10px]">This Week</span>
              <span className="font-bold text-ink">
                {Math.floor(focusWeekMin / 60)}h {focusWeekMin % 60}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-surface border border-border text-center space-y-4 max-w-lg mx-auto my-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-bold text-xl text-ink">Welcome to Planora</h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            You don&apos;t have any subjects set up yet. Complete the quick 3-minute setup to generate your realistic timetable.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-all"
            >
              Start 3-Minute Setup
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4 · RECOVER CARD: FIX MY PLAN (Visible when missed blocks exist) */}
          {missedBlocks.length > 0 && (
        <section
          aria-labelledby="recovery-card-heading"
          className="p-5 sm:p-6 rounded-2xl bg-surface border border-primary/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                {formatLostTime(missedMinutes)}
              </span>
            </div>
            <h2 id="recovery-card-heading" className="font-heading font-bold text-lg text-ink">
              Life happens. Let&apos;s adjust calmly.
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-xl leading-relaxed">
              You have {missedBlocks.length} missed sessions from previous days. One tap recalculates
              all remaining work starting today under your declared daily hours — with zero guilt.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Fix my plan</span>
          </button>
        </section>
      )}

      {/* Top Stat Row: Progress Ring + Exam Countdowns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Syllabus Progress Ring Card */}
        <div className="md:col-span-5 bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 self-start">
            Syllabus Completion
          </h2>

          <ProgressRing
            progressPercent={progressPercent}
            size={140}
            strokeWidth={12}
            sublabel={`${Math.round(completedSyllabusMin / 60)}h of ${Math.round(totalSyllabusMin / 60)}h`}
          />

          <p className="text-xs text-muted mt-4 font-medium">
            {completedSyllabusMin >= totalSyllabusMin && totalSyllabusMin > 0
              ? 'All chapters completed!'
              : `${Math.max(0, Math.round((totalSyllabusMin - completedSyllabusMin) / 60))} hours left in revision`}
          </p>
        </div>

        {/* Exam Countdown Cards */}
        <div className="md:col-span-7 bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Upcoming Exams
            </h2>

            <div className="space-y-3">
              {examCountdowns.length === 0 ? (
                <p className="text-xs text-muted py-4">No exams scheduled yet. Set exam dates in Settings or Plan.</p>
              ) : (
                examCountdowns.map((sub) => {
                  const isUrgent = sub.daysLeft <= 3;
                  const isPast = sub.daysLeft < 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <SubjectBadge name={sub.name} colorKey={sub.color_key} />
                        <span className="text-xs text-muted truncate">
                          {sub.exam_date}
                        </span>
                      </div>

                      <div>
                        {isPast ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-surface border border-border text-muted font-medium">
                            Completed
                          </span>
                        ) : isUrgent ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-danger/10 text-danger border border-danger/20 font-semibold flex items-center gap-1">
                            {sub.daysLeft === 0 ? 'Today!' : `${sub.daysLeft}d left`}
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-primary-soft text-primary font-medium">
                            in {sub.daysLeft} days
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border mt-3 flex items-center justify-between text-xs text-muted">
            <span>Scheduling stops 1 day before exam</span>
            <span>Target: {profile?.daily_hours || 2}h daily cap</span>
          </div>
        </div>
      </div>

      {/* VISUAL TIMETABLE */}
      <section aria-labelledby="timetable-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="timetable-heading" className="font-heading font-bold text-xl text-ink">
              Weekly Timetable
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Interactive visual roadmap with rest breaks, today focus column, and real-time indicator.
            </p>
          </div>
        </div>

        <WeekTimetable
          subjects={subjects}
          chapters={chapters}
          blocks={blocks}
          onToggleBlockStatus={handleToggleBlockStatus}
          onToggleLockBlock={handleToggleLockBlock}
          onMoveBlockToTomorrow={handleMoveBlockToTomorrow}
          onStartPomodoroForBlock={(block) => setActivePomodoroBlockId(block.id)}
        />
      </section>

      {/* POMODORO FOCUS TIMER */}
      <section aria-labelledby="pomodoro-heading" className="pt-2">
        <PomodoroTimer
          userId={user?.id}
          todayBlocks={todayBlocks}
          subjects={subjects}
          chapters={chapters}
          activeBlockId={activePomodoroBlockId}
          onMarkBlockDone={async (block: Block) => {
            await handleToggleBlockStatus(block, 'done');
          }}
          defaultSessionMin={profile?.session_min || 25}
        />
      </section>

      {/* TODAY'S SESSIONS: 3 · MARK REALITY, NOT THE PLAN */}
      <section aria-labelledby="today-heading" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="today-heading" className="font-heading font-bold text-xl text-ink">
              Today&apos;s Sessions
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Mark reality, not the plan. Exactly two actions: Done and Not yet.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-2 border border-border text-ink">
            {todayBlocks.filter((b) => b.status === 'done').length}/{todayBlocks.length} Done
          </span>
        </div>

        {todayBlocks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-mint-soft text-mint flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-ink">
              No sessions scheduled for today
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
              You are completely clear! Rest up or check your full plan for tomorrow.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayBlocks.map((block) => {
              const chapter = chapterMap.get(block.chapter_id);
              const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;
              const isDone = block.status === 'done';

              return (
                <article
                  key={block.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-surface border transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDone ? 'border-mint/30 bg-mint-soft/10 opacity-80' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Interactive tick box */}
                    <button
                      type="button"
                      onClick={() => handleToggleBlockStatus(block, isDone ? 'scheduled' : 'done')}
                      aria-label={isDone ? `Uncheck "${chapter?.title}"` : `Check "${chapter?.title}" as done`}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isDone
                          ? 'bg-mint border-mint text-white shadow-sm'
                          : 'border-border bg-surface-2 hover:border-primary text-transparent'
                      }`}
                      title={isDone ? 'Click to uncheck (Mark as Not Yet)' : 'Click to check as Done'}
                    >
                      <Check className={`w-4 h-4 stroke-[3] ${isDone ? 'opacity-100 text-white' : 'opacity-0'}`} />
                    </button>

                    <div className="flex flex-col items-center justify-center bg-surface-2 border border-border rounded-xl px-3 py-2 text-center shrink-0 min-w-[76px]">
                      <span className="text-xs font-bold text-ink leading-none">
                        {formatMinutesToTime(block.start_min)}
                      </span>
                      <span className="text-[10px] text-muted font-medium mt-1">
                        {block.duration_min}m
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {subject && (
                          <SubjectBadge
                            name={subject.name}
                            colorKey={subject.color_key}
                            size="sm"
                          />
                        )}
                        {block.is_locked && (
                          <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-soft flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>
                      <h3 className={`font-heading font-semibold text-base text-ink truncate ${isDone ? 'line-through text-muted' : ''}`}>
                        {chapter?.title || 'Chapter Study'}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {/* Focus now button */}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => setActivePomodoroBlockId(block.id)}
                        className="px-3.5 py-2 rounded-xl bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Focus</span>
                      </button>
                    )}

                    {isDone ? (
                      <button
                        type="button"
                        onClick={() => handleToggleBlockStatus(block, 'scheduled')}
                        className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-muted text-xs font-semibold hover:text-ink transition-colors min-h-[40px] flex items-center gap-1.5"
                      >
                        <span>Mark Not Yet</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleBlockStatus(block, 'done')}
                        className="px-5 py-2 rounded-xl bg-mint text-white text-xs font-bold shadow-sm hover:opacity-95 transition-all min-h-[40px] flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

        </>
      )}

      {/* Recovery Modal */}
      <RecoveryModal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        subjects={subjects}
        chapters={chapters}
        blocks={blocks}
        dailyHours={profile?.daily_hours || 2}
        sessionMin={profile?.session_min || 45}
        breakMin={profile?.break_min || 10}
        onAccept={handleApplyRecovery}
      />
    </div>
  );
};
