import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Clock,
  Calendar,
  Lock,
  Unlock,
  Play,
  ArrowRight,
  Sparkles,
  Target,
} from 'lucide-react';
import { SubjectBadge, subjectColorMap } from './SubjectBadge';
import { Modal } from './Modal';
import { formatDate, addDays, parseDate } from '../lib/scheduler';
import type { Subject, Chapter, Block } from '../types/database';

interface WeekTimetableProps {
  subjects: Subject[];
  chapters: Chapter[];
  blocks: Block[];
  onToggleBlockStatus?: (block: Block, newStatus: 'done' | 'scheduled') => Promise<void>;
  onToggleLockBlock?: (block: Block) => Promise<void>;
  onMoveBlockToTomorrow?: (block: Block) => Promise<void>;
  onStartPomodoroForBlock?: (block: Block) => void;
  className?: string;
}

const START_HOUR = 6; // 06:00
const END_HOUR = 23; // 23:00
const TOTAL_HOURS = END_HOUR - START_HOUR; // 17 hours
const HOUR_HEIGHT = 46; // px per hour
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 782px

function formatMinTo12h(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

export const WeekTimetable: React.FC<WeekTimetableProps> = ({
  subjects,
  chapters,
  blocks,
  onToggleBlockStatus,
  onToggleLockBlock,
  onMoveBlockToTomorrow,
  onStartPomodoroForBlock,
  className = '',
}) => {
  const todayStr = useMemo(() => formatDate(new Date()), []);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);
  const [currentTimeMin, setCurrentTimeMin] = useState<number | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Maps for lookups
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // Generate 7 days starting from today
  const weekDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = addDays(todayStr, i);
      const d = parseDate(dateStr);
      list.push({
        dateStr,
        weekday: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
        fullDayName: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        dateFormatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        isToday: i === 0,
      });
    }
    return list;
  }, [todayStr]);

  // Group blocks by date
  const blocksByDate = useMemo(() => {
    const map = new Map<string, Block[]>();
    blocks.forEach((b) => {
      const arr = map.get(b.date) || [];
      arr.push(b);
      map.set(b.date, arr);
    });
    // Sort each day's blocks by start_min
    map.forEach((arr) => arr.sort((a, b) => a.start_min - b.start_min));
    return map;
  }, [blocks]);

  // Today's stats for focus column
  const todayBlocks = useMemo(() => blocksByDate.get(todayStr) || [], [blocksByDate, todayStr]);
  const todayPlannedMin = useMemo(
    () => todayBlocks.reduce((acc, b) => acc + b.duration_min, 0),
    [todayBlocks]
  );
  const todayCompletedMin = useMemo(
    () =>
      todayBlocks
        .filter((b) => b.status === 'done')
        .reduce((acc, b) => acc + b.duration_min, 0),
    [todayBlocks]
  );

  // Next up block for today
  const nextUpBlock = useMemo(() => {
    return todayBlocks.find((b) => b.status === 'scheduled');
  }, [todayBlocks]);

  // Update current time indicator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setCurrentTimeMin(mins);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMobileTabClick = (index: number) => {
    setSelectedDayIndex(index);
    if (carouselRef.current) {
      const width = carouselRef.current.clientWidth;
      carouselRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth',
      });
    }
  };

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const width = carouselRef.current.clientWidth;
    const idx = Math.round(scrollLeft / width);
    if (idx !== selectedDayIndex && idx >= 0 && idx < 7) {
      setSelectedDayIndex(idx);
    }
  };

  // Hours array for grid labels
  const hours = useMemo(() => {
    const arr = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      arr.push({ hour: h, label: `${displayH} ${ampm}` });
    }
    return arr;
  }, []);

  // Current time position relative to grid
  const currentTimeTop = useMemo(() => {
    if (currentTimeMin === null) return null;
    const startMins = START_HOUR * 60;
    const endMins = END_HOUR * 60;
    if (currentTimeMin < startMins || currentTimeMin > endMins) return null;
    return ((currentTimeMin - startMins) / 60) * HOUR_HEIGHT;
  }, [currentTimeMin]);

  const activeChapter = activeBlock ? chapterMap.get(activeBlock.chapter_id) : null;
  const activeSubject = activeChapter ? subjectMap.get(activeChapter.subject_id) : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ========================================================
          MOBILE VIEW (< 1024px)
          Horizontal scroll-snap carousel with day tabs above
          ======================================================== */}
      <div className="block lg:hidden space-y-3">
        {/* Day Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Day selection">
          {weekDays.map((day, idx) => {
            const dayBlocks = blocksByDate.get(day.dateStr) || [];
            const hasBlocks = dayBlocks.length > 0;
            const isSelected = selectedDayIndex === idx;

            return (
              <button
                key={day.dateStr}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleMobileTabClick(idx)}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-input border transition-all flex-1 min-w-[62px] min-h-[44px] ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface border-border text-muted hover:text-ink'
                }`}
              >
                <span className="text-[11px] font-semibold uppercase">{day.weekday}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-bold leading-none">{day.dateFormatted.split(' ')[1]}</span>
                  {hasBlocks && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-mint'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Carousel Container */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-card bg-surface border border-border"
        >
          {weekDays.map((day) => {
            const dayBlocks = blocksByDate.get(day.dateStr) || [];
            const totalStudyMin = dayBlocks.reduce((acc, b) => acc + b.duration_min, 0);

            return (
              <div
                key={day.dateStr}
                className="w-full flex-shrink-0 snap-center p-4 min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h3 className="font-heading font-bold text-base text-ink">
                        {day.fullDayName}
                      </h3>
                      <p className="text-xs text-muted">{day.dateFormatted}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-pill bg-surface-2 border border-border text-ink">
                      {totalStudyMin > 0 ? `${totalStudyMin}m study` : 'Rest day'}
                    </span>
                  </div>

                  {/* Day Blocks List */}
                  <div className="pt-4 space-y-2.5">
                    {dayBlocks.length === 0 ? (
                      <div className="py-16 text-center">
                        <p className="text-xs text-muted font-medium">Nothing scheduled</p>
                      </div>
                    ) : (
                      dayBlocks.map((b) => {
                        const chapter = chapterMap.get(b.chapter_id);
                        const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;
                        const color = subjectColorMap[subject?.color_key || '1'];
                        const isDone = b.status === 'done';

                        return (
                          <div
                            key={b.id}
                            onClick={() => setActiveBlock(b)}
                            className="p-3 rounded-input border transition-all cursor-pointer flex items-center justify-between gap-3 bg-surface hover:border-primary/40"
                            style={{
                              borderLeft: `4px solid ${color.hex}`,
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Status Tick Box */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onToggleBlockStatus) {
                                    onToggleBlockStatus(b, isDone ? 'scheduled' : 'done');
                                  }
                                }}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  isDone
                                    ? 'bg-mint border-mint text-white'
                                    : 'border-border bg-surface hover:border-primary'
                                }`}
                                aria-label="Toggle status"
                              >
                                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[11px] font-bold uppercase tracking-wider truncate"
                                    style={{ color: color.hex }}
                                  >
                                    {subject?.name || 'Subject'}
                                  </span>
                                  <span className="text-[11px] text-muted">
                                    {formatMinTo12h(b.start_min)} - {formatMinTo12h(b.start_min + b.duration_min)}
                                  </span>
                                  {b.is_locked && (
                                    <Lock className="w-3 h-3 text-primary inline" />
                                  )}
                                </div>
                                <p className={`text-sm font-semibold text-ink truncate ${isDone ? 'line-through text-muted' : ''}`}>
                                  {chapter?.title || 'Chapter Study'}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs px-2 py-1 rounded-pill bg-surface-2 border border-border text-muted font-medium shrink-0">
                              {b.duration_min}m
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
                  <span>Swipe to see other days</span>
                  <span>Tap any session to edit</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          DESKTOP VIEW (≥ 1024px)
          7 day columns × time rows + Right-hand Focus Column
          ======================================================== */}
      <div className="hidden lg:grid lg:grid-cols-1 xl:grid-cols-[1fr_290px] gap-5 items-start">
        {/* 7-Day Timetable Canvas */}
        <div className="bg-surface border border-border rounded-card p-5 shadow-card overflow-hidden">
          {/* Table Header: 7 Columns */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-2 pb-3 border-b border-border">
            <div className="text-[11px] font-semibold text-muted uppercase flex items-center justify-center">
              Time
            </div>

            {weekDays.map((day) => {
              const dayBlocks = blocksByDate.get(day.dateStr) || [];
              const hasBlocks = dayBlocks.length > 0;

              return (
                <div
                  key={day.dateStr}
                  className={`py-2 px-2 text-center rounded-xl transition-colors ${
                    day.isToday ? 'bg-primary-soft text-primary font-bold' : 'bg-surface-2 text-ink'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs uppercase tracking-wider">
                      {day.weekday}
                    </span>
                    {hasBlocks && (
                      <span className="w-1.5 h-1.5 rounded-full bg-mint" title="Has scheduled sessions" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted block mt-0.5">{day.dateFormatted}</span>
                </div>
              );
            })}
          </div>

          {/* Timetable Body Grid: Fixed 06:00 to 23:00 */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-2 relative mt-2" style={{ height: TOTAL_HEIGHT }}>
            {/* Time axis column */}
            <div className="relative border-r border-border select-none">
              {hours.map((h, i) => (
                <div
                  key={h.hour}
                  className="absolute text-[10px] text-muted font-medium -translate-y-1/2 w-full pr-2 text-right"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* 7 Day Columns */}
            {weekDays.map((day) => {
              const dayBlocks = blocksByDate.get(day.dateStr) || [];
              const isToday = day.isToday;

              return (
                <div
                  key={day.dateStr}
                  className={`relative rounded-xl transition-colors overflow-hidden ${
                    isToday
                      ? 'bg-primary-soft/10 border-t-2 border-primary'
                      : 'bg-surface-2/20 border-border/30'
                  }`}
                  style={{ height: TOTAL_HEIGHT }}
                >
                  {/* Horizontal hour grid lines */}
                  {hours.map((h, i) => (
                    <div
                      key={h.hour}
                      className="absolute inset-x-0 border-t border-border/20 pointer-events-none"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current Time Indicator on Today's Column */}
                  {isToday && currentTimeTop !== null && (
                    <div
                      className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                      style={{ top: currentTimeTop }}
                    >
                      <div className="w-2 h-2 rounded-full bg-danger -ml-1" />
                      <div className="flex-1 h-[1.5px] bg-danger shadow-sm" />
                    </div>
                  )}

                  {/* Day Blocks */}
                  {dayBlocks.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-muted font-medium">Rest</span>
                    </div>
                  ) : (
                    dayBlocks.map((b, bIdx) => {
                      const chapter = chapterMap.get(b.chapter_id);
                      const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;
                      const color = subjectColorMap[subject?.color_key || '1'];
                      const isDone = b.status === 'done';

                      const startDiffMin = b.start_min - START_HOUR * 60;
                      const topPx = (startDiffMin / 60) * HOUR_HEIGHT;
                      const heightPx = Math.max(34, (b.duration_min / 60) * HOUR_HEIGHT);

                      const prevBlock = bIdx > 0 ? dayBlocks[bIdx - 1] : null;
                      const hasBreakBefore = prevBlock && b.start_min > (prevBlock.start_min + prevBlock.duration_min);

                      return (
                        <React.Fragment key={b.id}>
                          {hasBreakBefore && (
                            <div
                              className="absolute inset-x-1 border-t border-dashed border-border pointer-events-none"
                              style={{ top: topPx - 5 }}
                            />
                          )}

                          <div
                            onClick={() => setActiveBlock(b)}
                            className="absolute inset-x-1 rounded-lg p-1.5 cursor-pointer shadow-sm hover:brightness-105 transition-all overflow-hidden flex flex-col justify-between group z-10"
                            style={{
                              top: topPx,
                              height: heightPx,
                              backgroundColor: color.bgSoft,
                              borderLeft: `3px solid ${color.hex}`,
                            }}
                            title={`${subject?.name || 'Subject'}: ${chapter?.title || 'Chapter'}`}
                          >
                            <div className="min-w-0 leading-tight">
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wider truncate"
                                  style={{ color: color.hex }}
                                >
                                  {subject?.name || 'Subject'}
                                </span>
                                {b.is_locked && (
                                  <Lock className="w-2.5 h-2.5 text-primary shrink-0" />
                                )}
                              </div>
                              <span
                                className={`block text-[11px] font-semibold text-ink truncate mt-0.5 ${
                                  isDone ? 'line-through text-muted' : ''
                                }`}
                              >
                                {chapter?.title || 'Study'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted mt-1 leading-none">
                              <span>{formatMinTo12h(b.start_min)}</span>
                              {isDone && <Check className="w-3 h-3 text-mint flex-shrink-0" />}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right-hand Focus Column / Panel (Desktop) */}
        <div className="space-y-4">
          {/* Today's Focus Card */}
          <div className="bg-surface border border-border rounded-card p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm text-ink">Today&apos;s Focus</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                {todayCompletedMin}/{todayPlannedMin}m
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{
                    width: `${todayPlannedMin > 0 ? Math.min(100, Math.round((todayCompletedMin / todayPlannedMin) * 100)) : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted mt-1.5">
                <span>{todayPlannedMin > 0 ? `${Math.round((todayCompletedMin / todayPlannedMin) * 100)}% completed` : 'No study today'}</span>
                <span>{todayBlocks.length} sessions</span>
              </div>
            </div>

            {/* Next Up Session */}
            {nextUpBlock ? (
              (() => {
                const nCh = chapterMap.get(nextUpBlock.chapter_id);
                const nSub = nCh ? subjectMap.get(nCh.subject_id) : undefined;
                return (
                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Next Up
                      </span>
                      <span className="text-xs text-primary font-semibold">
                        {formatMinTo12h(nextUpBlock.start_min)}
                      </span>
                    </div>

                    <div>
                      {nSub && <SubjectBadge name={nSub.name} colorKey={nSub.color_key} size="sm" />}
                      <h4 className="text-xs font-bold text-ink mt-1.5 truncate">
                        {nCh?.title || 'Study Session'}
                      </h4>
                      <p className="text-[11px] text-muted">
                        Duration: {nextUpBlock.duration_min}m ({Math.max(1, Math.round(nextUpBlock.duration_min / 25))} cycles)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {onStartPomodoroForBlock && (
                        <button
                          type="button"
                          onClick={() => onStartPomodoroForBlock(nextUpBlock)}
                          className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Focus Now
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (onToggleBlockStatus) {
                            onToggleBlockStatus(nextUpBlock, 'done');
                          }
                        }}
                        className="p-1.5 rounded-lg border border-border bg-surface hover:bg-mint-soft hover:text-mint hover:border-mint/30 transition-colors"
                        title="Mark as done"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-4 rounded-xl bg-surface-2/40 border border-dashed border-border text-center text-xs text-muted">
                {todayBlocks.length > 0
                  ? 'All of today’s study blocks completed!'
                  : 'No sessions scheduled for today.'}
              </div>
            )}
          </div>

          {/* Quick Schedule Tips / Insights */}
          <div className="bg-surface border border-border rounded-card p-4 shadow-card text-xs space-y-2">
            <h4 className="font-semibold text-ink flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Focus Rule
            </h4>
            <p className="text-muted leading-relaxed text-[11px]">
              Lock important blocks to prevent automatic rescheduling. Sessions are automatically spaced with breaks to prevent cognitive fatigue.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          BLOCK DETAIL MODAL
          ======================================================== */}
      {activeBlock && (
        <Modal
          isOpen={Boolean(activeBlock)}
          onClose={() => setActiveBlock(null)}
          title="Session Details"
          description="Mark reality, lock, or adjust this study block."
          maxWidth="max-w-md"
        >
          <div className="space-y-5">
            <div className="p-4 rounded-card bg-surface-2 border border-border space-y-3">
              <div className="flex items-center justify-between">
                {activeSubject && (
                  <SubjectBadge name={activeSubject.name} colorKey={activeSubject.color_key} size="md" />
                )}
                {activeBlock.is_locked && (
                  <span className="text-xs font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary-soft flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked in Schedule
                  </span>
                )}
              </div>

              <h3 className="font-heading font-bold text-lg text-ink">
                {activeChapter?.title || 'Chapter Session'}
              </h3>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted pt-1">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Calendar className="w-4 h-4 text-primary" />
                  {activeBlock.date}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Clock className="w-4 h-4 text-primary" />
                  {formatMinTo12h(activeBlock.start_min)} - {formatMinTo12h(activeBlock.start_min + activeBlock.duration_min)} ({activeBlock.duration_min}m)
                </span>
              </div>
            </div>

            {/* Quick Actions (Lock, Move, Pomodoro) */}
            <div className="grid grid-cols-3 gap-2">
              {onToggleLockBlock && (
                <button
                  type="button"
                  onClick={async () => {
                    await onToggleLockBlock(activeBlock);
                    setActiveBlock((prev) => prev ? { ...prev, is_locked: !prev.is_locked } : null);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${
                    activeBlock.is_locked
                      ? 'bg-primary-soft border-primary/30 text-primary'
                      : 'bg-surface-2 border-border text-muted hover:text-ink'
                  }`}
                >
                  {activeBlock.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  <span>{activeBlock.is_locked ? 'Locked' : 'Lock'}</span>
                </button>
              )}

              {onMoveBlockToTomorrow && activeBlock.status !== 'done' && (
                <button
                  type="button"
                  onClick={async () => {
                    await onMoveBlockToTomorrow(activeBlock);
                    setActiveBlock(null);
                  }}
                  className="py-2 px-3 text-xs font-semibold rounded-xl border border-border bg-surface-2 text-muted hover:text-ink flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Tomorrow</span>
                </button>
              )}

              {onStartPomodoroForBlock && activeBlock.status !== 'done' && (
                <button
                  type="button"
                  onClick={() => {
                    onStartPomodoroForBlock(activeBlock);
                    setActiveBlock(null);
                  }}
                  className="py-2 px-3 text-xs font-semibold rounded-xl bg-primary-soft border border-primary/30 text-primary hover:bg-primary hover:text-white flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Focus</span>
                </button>
              )}
            </div>

            {/* Action Buttons: Done / Not yet */}
            <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
              {activeBlock.status === 'done' ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (onToggleBlockStatus) {
                      await onToggleBlockStatus(activeBlock, 'scheduled');
                    }
                    setActiveBlock(null);
                  }}
                  className="w-full px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-muted hover:text-ink text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Mark as Not Yet</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (onToggleBlockStatus) {
                      await onToggleBlockStatus(activeBlock, 'done');
                    }
                    setActiveBlock(null);
                  }}
                  className="w-full px-5 py-2.5 rounded-xl bg-mint text-white font-bold text-sm shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Mark as Done</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
