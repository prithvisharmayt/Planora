import React from 'react';
import {
  Check,
  Clock,
  Lock,
  Unlock,
  Play,
  ArrowRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import { formatDate, addDays, parseDate } from '../lib/scheduler';
import type { Subject, Chapter, Block } from '../types/database';

interface WeeklyListViewProps {
  subjects: Subject[];
  chapters: Chapter[];
  blocks: Block[];
  onToggleBlockStatus: (block: Block, targetStatus: 'done' | 'scheduled') => Promise<void>;
  onToggleLockBlock?: (block: Block) => Promise<void>;
  onMoveBlockToTomorrow?: (block: Block) => Promise<void>;
  onStartPomodoroForBlock?: (block: Block) => void;
}

function formatMinTo12h(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

export const WeeklyListView: React.FC<WeeklyListViewProps> = ({
  subjects,
  chapters,
  blocks,
  onToggleBlockStatus,
  onToggleLockBlock,
  onMoveBlockToTomorrow,
  onStartPomodoroForBlock,
}) => {
  const todayStr = formatDate(new Date());

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));

  // Generate 7 days
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(todayStr, i);
    const d = parseDate(dateStr);
    const dayBlocks = blocks
      .filter((b) => b.date === dateStr)
      .sort((a, b) => a.start_min - b.start_min);

    const totalMin = dayBlocks.reduce((acc, b) => acc + b.duration_min, 0);
    const doneMin = dayBlocks
      .filter((b) => b.status === 'done')
      .reduce((acc, b) => acc + b.duration_min, 0);

    weekDays.push({
      dateStr,
      weekday: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
      dateFormatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      isToday: i === 0,
      blocks: dayBlocks,
      totalMin,
      doneMin,
    });
  }

  return (
    <div className="space-y-6">
      {weekDays.map((day) => (
        <div
          key={day.dateStr}
          className={`rounded-2xl border transition-all ${
            day.isToday
              ? 'bg-surface border-primary/30 shadow-sm ring-1 ring-primary/20'
              : 'bg-surface border-border'
          } p-5 sm:p-6`}
        >
          {/* Day Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  day.isToday ? 'bg-primary text-white' : 'bg-surface-2 text-ink'
                }`}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-base text-ink">{day.weekday}</h3>
                  {day.isToday && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{day.dateFormatted}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-2 text-ink border border-border">
                {day.totalMin > 0 ? `${day.totalMin}m planned` : 'Rest day'}
              </span>
              {day.doneMin > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-mint-soft text-mint border border-mint/20">
                  {day.doneMin}m completed
                </span>
              )}
            </div>
          </div>

          {/* Blocks Table / List */}
          {day.blocks.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No study sessions scheduled for this day.
            </div>
          ) : (
            <div className="divide-y divide-border/40 mt-2">
              {day.blocks.map((b) => {
                const chapter = chapterMap.get(b.chapter_id);
                const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;
                const isDone = b.status === 'done';
                const isMissed = b.status === 'missed';
                const endTime = b.start_min + b.duration_min;
                const pomodoroCycles = Math.max(1, Math.round(b.duration_min / 25));

                return (
                  <div
                    key={b.id}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors rounded-xl px-2 hover:bg-surface-2/40 ${
                      isDone ? 'opacity-75' : ''
                    }`}
                  >
                    {/* Left: Checkbox & Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      {/* Interactive Status Tick Box */}
                      <button
                        type="button"
                        onClick={() =>
                          onToggleBlockStatus(b, isDone ? 'scheduled' : 'done')
                        }
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-all ${
                          isDone
                            ? 'bg-mint border-mint text-white shadow-sm'
                            : 'border-border hover:border-primary bg-surface'
                        }`}
                        title={isDone ? 'Mark as Not yet' : 'Mark as Done'}
                        aria-label={`Mark ${chapter?.title || 'session'} as ${isDone ? 'incomplete' : 'done'}`}
                      >
                        {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      {/* Content */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {subject && (
                            <SubjectBadge
                              name={subject.name}
                              colorKey={subject.color_key}
                              size="sm"
                            />
                          )}
                          {chapter?.unit_title && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-2 text-muted">
                              {chapter.unit_title}
                            </span>
                          )}
                          {b.is_locked && (
                            <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-soft flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          )}
                          {isMissed && !isDone && (
                            <span className="text-[10px] font-semibold text-danger px-2 py-0.5 rounded-full bg-danger/10">
                              Missed
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-sm font-semibold text-ink truncate ${
                            isDone ? 'line-through text-muted' : ''
                          }`}
                        >
                          {chapter?.title || 'Study Session'}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatMinTo12h(b.start_min)} – {formatMinTo12h(endTime)} ({b.duration_min}m)
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-primary" />
                            {pomodoroCycles} focus {pomodoroCycles === 1 ? 'cycle' : 'cycles'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Start Pomodoro Focus Button */}
                      {onStartPomodoroForBlock && !isDone && (
                        <button
                          type="button"
                          onClick={() => onStartPomodoroForBlock(b)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary-soft text-primary hover:bg-primary hover:text-white transition-colors flex items-center gap-1.5"
                          title="Start Pomodoro Focus"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Focus
                        </button>
                      )}

                      {/* Lock / Unlock Toggle */}
                      {onToggleLockBlock && (
                        <button
                          type="button"
                          onClick={() => onToggleLockBlock(b)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            b.is_locked
                              ? 'bg-primary-soft border-primary/30 text-primary'
                              : 'bg-surface border-border text-muted hover:text-ink'
                          }`}
                          title={b.is_locked ? 'Unlock block' : 'Lock block in place'}
                        >
                          {b.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* Move to Tomorrow */}
                      {onMoveBlockToTomorrow && !isDone && (
                        <button
                          type="button"
                          onClick={() => onMoveBlockToTomorrow(b)}
                          className="p-1.5 rounded-lg border border-border text-muted hover:text-ink bg-surface transition-colors"
                          title="Move session to tomorrow"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

