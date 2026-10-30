import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { formatDate, diffDays } from '../lib/scheduler';
import { SubjectBadge } from '../components/SubjectBadge';
import { ProgressRing } from '../components/ProgressRing';
import { RecoveryModal } from '../components/RecoveryModal';
import { WeekTimetable } from '../components/WeekTimetable';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { Seo } from '../components/Seo';
import type { Subject, Chapter, Block } from '../types/database';

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
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [subs, chaps, blks] = await Promise.all([
        dataService.getSubjects(user.id),
        dataService.getChapters(user.id),
        dataService.getBlocks(user.id),
      ]);

      if (subs.length === 0) {
        navigate('/setup', { replace: true });
        return;
      }

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
    <div className="space-y-8">
      <Seo
        title="Dashboard — Today's Focus"
        description="View your realistic daily study blocks, visual timetable, and exam countdowns."
        noIndex={true}
        canonicalPath="/app"
      />

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Today's Focus
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
      </div>

      {/* 4 · RECOVER CARD: FIX MY PLAN (Visible when missed blocks exist) */}
      {missedBlocks.length > 0 && (
        <section
          aria-labelledby="recovery-card-heading"
          className="p-5 sm:p-6 rounded-card bg-surface border border-primary/30 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber">
                {formatLostTime(missedMinutes)}
              </span>
            </div>
            <h2 id="recovery-card-heading" className="font-heading font-bold text-lg text-ink">
              Life happens. Let's adjust.
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-xl">
              You have {missedBlocks.length} missed sessions from previous days. One tap recalculates
              all remaining work starting today — with zero guilt.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsRecoveryOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-input bg-cta-gradient text-white text-sm font-semibold shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center gap-2 pressable whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Fix my plan</span>
          </button>
        </section>
      )}

      {/* Top Stat Row: Progress Ring + Exam Countdowns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Syllabus Progress Ring Card */}
        <div className="md:col-span-5 bg-surface border border-border rounded-card p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 self-start">
            Syllabus Completion
          </h2>

          <ProgressRing
            progressPercent={progressPercent}
            size={140}
            strokeWidth={12}
            sublabel={`${Math.round(completedSyllabusMin / 60)}h of ${Math.round(totalSyllabusMin / 60)}h`}
          />

          <p className="text-xs text-muted mt-4">
            {completedSyllabusMin >= totalSyllabusMin && totalSyllabusMin > 0
              ? 'All chapters completed!'
              : `${Math.max(0, Math.round((totalSyllabusMin - completedSyllabusMin) / 60))} hours left in revision`}
          </p>
        </div>

        {/* Exam Countdown Cards */}
        <div className="md:col-span-7 bg-surface border border-border rounded-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Upcoming Exams
            </h2>

            <div className="space-y-3">
              {examCountdowns.length === 0 ? (
                <p className="text-xs text-muted py-4">No exams scheduled yet. Set exam dates in Settings or Setup.</p>
              ) : (
                examCountdowns.map((sub) => {
                  const isUrgent = sub.daysLeft <= 3;
                  const isPast = sub.daysLeft < 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-input bg-surface-2 border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <SubjectBadge name={sub.name} colorKey={sub.color_key} />
                        <span className="text-xs text-muted truncate">
                          {sub.exam_date}
                        </span>
                      </div>

                      <div>
                        {isPast ? (
                          <span className="text-xs px-2.5 py-1 rounded-pill bg-surface border border-border text-muted font-medium">
                            Completed
                          </span>
                        ) : isUrgent ? (
                          <span className="text-xs px-2.5 py-1 rounded-pill bg-rose/15 text-rose border border-rose/30 font-semibold flex items-center gap-1">
                            {sub.daysLeft === 0 ? 'Today!' : `${sub.daysLeft}d left`}
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-pill bg-primary-soft text-primary font-medium">
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

      {/* VISUAL TIMETABLE (Centrepiece - Change 5)
          Placed on the Dashboard directly beneath the stat row */}
      <section aria-labelledby="timetable-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="timetable-heading" className="font-heading font-bold text-xl text-ink">
              Weekly Timetable
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Interactive visual roadmap with rest breaks and real-time indicator.
            </p>
          </div>
        </div>

        <WeekTimetable
          subjects={subjects}
          chapters={chapters}
          blocks={blocks}
          onToggleBlockStatus={handleToggleBlockStatus}
        />
      </section>

      {/* POMODORO FOCUS TIMER */}
      <section aria-labelledby="pomodoro-heading" className="pt-2">
        <PomodoroTimer
          todayBlocks={todayBlocks}
          subjects={subjects}
          chapters={chapters}
          onMarkBlockDone={async (block: Block) => {
            await handleToggleBlockStatus(block, 'done');
          }}
          defaultSessionMin={profile?.session_min || 25}
        />
      </section>

      {/* TODAY'S BLOCKS: 3 · MARK REALITY, NOT THE PLAN */}
      <section aria-labelledby="today-heading" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="today-heading" className="font-heading font-bold text-xl text-ink">
              Today's Sessions
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Mark reality, not the plan. Exactly two actions: Done and Not yet.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-pill bg-surface-2 border border-border text-ink">
            {todayBlocks.filter((b) => b.status === 'done').length}/{todayBlocks.length} Done
          </span>
        </div>

        {todayBlocks.length === 0 ? (
          <div className="p-8 rounded-card bg-surface border border-border text-center space-y-3 shadow-sm">
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
                  className={`p-4 sm:p-5 rounded-card bg-surface border transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDone ? 'border-mint/30 bg-mint-soft/10 opacity-80' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Tick box checkbox for task completion */}
                    <button
                      type="button"
                      onClick={() => handleToggleBlockStatus(block, isDone ? 'scheduled' : 'done')}
                      aria-label={isDone ? `Uncheck "${chapter?.title}"` : `Check "${chapter?.title}" as done`}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        isDone
                          ? 'bg-mint border-mint text-white shadow-sm'
                          : 'border-border bg-surface-2 hover:border-primary text-transparent'
                      }`}
                      title={isDone ? 'Click to uncheck (Mark as Not Yet)' : 'Click to check as Done'}
                    >
                      <Check className={`w-4 h-4 stroke-[3] ${isDone ? 'opacity-100 text-white' : 'opacity-0'}`} />
                    </button>

                    <div className="flex flex-col items-center justify-center bg-surface-2 border border-border rounded-input px-3 py-2 text-center flex-shrink-0 min-w-[76px]">
                      <span className="text-xs font-bold text-ink leading-none">
                        {formatMinutesToTime(block.start_min)}
                      </span>
                      <span className="text-[10px] text-muted font-medium mt-1">
                        {block.duration_min}m
                      </span>
                    </div>

                    <div className="min-w-0">
                      {subject && (
                        <div className="mb-1">
                          <SubjectBadge
                            name={subject.name}
                            colorKey={subject.color_key}
                            size="sm"
                          />
                        </div>
                      )}
                      <h3 className={`font-heading font-semibold text-base text-ink truncate ${isDone ? 'line-through text-muted' : ''}`}>
                        {chapter?.title || 'Chapter Study'}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isDone ? (
                      <button
                        type="button"
                        onClick={() => handleToggleBlockStatus(block, 'scheduled')}
                        className="px-4 py-2 rounded-input bg-surface-2 border border-border text-muted text-xs font-semibold hover:text-ink transition-colors min-h-[44px] flex items-center gap-1.5 pressable"
                      >
                        <span>Mark Not Yet</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleBlockStatus(block, 'done')}
                        className="px-5 py-2.5 rounded-input bg-mint text-bg text-xs font-bold shadow-sm hover:opacity-95 transition-all min-h-[44px] flex items-center gap-1.5 pressable"
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
