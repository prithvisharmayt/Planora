import React, { useMemo, useState } from 'react';
import { Sparkles, Calendar, ArrowRight, Check, X, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';
import { SubjectBadge } from './SubjectBadge';
import { generateSchedule, formatDate, diffDays } from '../lib/scheduler';
import type { Subject, Chapter, Block } from '../types/database';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  chapters: Chapter[];
  blocks: Block[];
  dailyHours: number;
  sessionMin: number;
  breakMin: number;
  onAccept: (newBlocks: Omit<Block, 'id' | 'created_at'>[]) => Promise<void>;
}

interface ChangeItem {
  id: string;
  chapterTitle: string;
  subjectName: string;
  colorKey: '1' | '2' | '3' | '4' | '5' | '6';
  newDate: string;
  startTimeFormatted: string;
  durationMin: number;
  reason: string;
  type: 'moved' | 'new';
}

function formatMinutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onClose,
  subjects,
  chapters,
  blocks,
  dailyHours,
  sessionMin,
  breakMin,
  onAccept,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const todayStr = useMemo(() => {
    return formatDate(new Date());
  }, []);

  const { newBlocksToInsert, changes, movedCount, newCount, deficits } = useMemo(() => {
    if (!isOpen) {
      return { newBlocksToInsert: [], changes: [], movedCount: 0, newCount: 0, deficits: [] };
    }

    const missedChapterIds = new Set<string>();
    blocks.forEach((b) => {
      if (b.status === 'missed' || (b.date < todayStr && b.status === 'scheduled')) {
        missedChapterIds.add(b.chapter_id);
      }
    });

    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: dailyHours,
        session_min: sessionMin,
        break_min: breakMin,
        start_date: todayStr,
      },
      existing_blocks: blocks,
      missed_chapter_ids: missedChapterIds,
    });

    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const chapterMap = new Map(chapters.map((c) => [c.id, c]));

    const oldBlocksByChapter = new Map<string, Block[]>();
    blocks.forEach((b) => {
      if (b.status !== 'done') {
        const list = oldBlocksByChapter.get(b.chapter_id) || [];
        list.push(b);
        oldBlocksByChapter.set(b.chapter_id, list);
      }
    });

    let moved = 0;
    let newlyCreated = 0;
    const changeList: ChangeItem[] = [];

    result.blocks.forEach((newB, idx) => {
      const chapter = chapterMap.get(newB.chapter_id);
      const subject = subjectMap.get(newB.subject_id);
      const oldCandidates = oldBlocksByChapter.get(newB.chapter_id) || [];

      let reason = '';
      let type: 'moved' | 'new' = 'moved';

      const daysToExam = (subject && subject.exam_date) ? diffDays(subject.exam_date, todayStr) : 14;

      if (oldCandidates.length > 0) {
        const matchedOld = oldCandidates.shift();
        if (matchedOld && matchedOld.date !== newB.date) {
          moved++;
          type = 'moved';
          if (matchedOld.status === 'missed') {
            const oldDayName = new Date(matchedOld.date).toLocaleDateString('en-US', { weekday: 'long' });
            reason = `Rediscovered from ${oldDayName}`;
          } else if (daysToExam <= 7 && subject?.exam_date) {
            reason = `${subject?.name || 'Subject'} exam in ${daysToExam} days`;
          } else {
            reason = `Balanced for your ${dailyHours}h daily cap`;
          }
        } else {
          reason = `Optimized schedule`;
        }
      } else {
        newlyCreated++;
        type = 'new';
        if (daysToExam <= 7 && subject?.exam_date) {
          reason = `${subject?.name || 'Subject'} exam in ${daysToExam} days`;
        } else {
          reason = `Spaced out to prevent marathon fatigue`;
        }
      }

      changeList.push({
        id: `rebuilt-${idx}`,
        chapterTitle: chapter?.title || 'Study Session',
        subjectName: subject?.name || 'Subject',
        colorKey: (subject?.color_key as any) || '1',
        newDate: newB.date,
        startTimeFormatted: formatMinutesToTime(newB.start_min),
        durationMin: newB.duration_min,
        reason,
        type,
      });
    });

    const newBlocksFormatted: Omit<Block, 'id' | 'created_at'>[] = result.blocks.map((b) => ({
      user_id: subjects[0]?.user_id || '',
      chapter_id: b.chapter_id,
      date: b.date,
      start_min: b.start_min,
      duration_min: b.duration_min,
      status: 'scheduled',
    }));

    return {
      newBlocksToInsert: newBlocksFormatted,
      changes: changeList,
      movedCount: moved,
      newCount: newlyCreated,
      deficits: result.deficits,
    };
  }, [isOpen, subjects, chapters, blocks, dailyHours, sessionMin, breakMin, todayStr]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onAccept(newBlocksToInsert);
      onClose();
    } catch (err) {
      console.error('Failed to apply recovered plan:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fix My Plan"
      description="Life happens. We recalculated your remaining sessions starting today with zero guilt."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Deficit Banner if exists */}
        {deficits.length > 0 && (
          <div className="p-4 rounded-card bg-amber/15 border border-amber/30 text-amber flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber" />
            <div className="text-sm">
              <p className="font-semibold text-ink">Calm heads up</p>
              {deficits.map((d) => (
                <p key={d.subject_id} className="mt-0.5">
                  {d.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Change Summary Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-primary-soft text-primary-hi font-semibold text-xs border border-primary/30">
            <Sparkles className="w-3.5 h-3.5" />
            {movedCount} moved, {newCount} new
          </span>
          <span className="text-xs text-muted">
            Completed sessions remain untouched.
          </span>
        </div>

        {/* Change List */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {changes.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">Your plan is already up to date!</p>
          ) : (
            changes.map((item) => {
              const isToday = item.newDate === todayStr;
              const dateDisplay = isToday
                ? 'Today'
                : new Date(item.newDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  });

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-input bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <SubjectBadge name={item.subjectName} colorKey={item.colorKey} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{item.chapterTitle}</p>
                      <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-ink">
                          <Calendar className="w-3.5 h-3.5 text-blue" />
                          {dateDisplay} · {item.startTimeFormatted}
                        </span>
                        <span>({item.durationMin}m)</span>
                      </div>
                    </div>
                  </div>

                  <div className="self-start sm:self-auto flex items-center">
                    <span className="text-xs px-2.5 py-1 rounded-pill bg-surface text-muted border border-border font-medium inline-flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-primary flex-shrink-0" />
                      {item.reason}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-input border border-border bg-surface-2 text-sm font-semibold text-muted hover:text-ink transition-colors min-h-[44px] pressable flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4 text-muted" />
            <span>Discard Changes</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || changes.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 rounded-input bg-cta-gradient text-white text-sm font-semibold shadow-cta hover:opacity-95 transition-all min-h-[44px] pressable flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
            <span>Accept New Plan</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
