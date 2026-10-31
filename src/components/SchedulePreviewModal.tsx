import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import type { Subject, Chapter, Block, ScheduleSnapshot } from '../types/database';
import type { ScheduledBlockItem, DeficitReport } from '../lib/scheduler';

interface SchedulePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => Promise<void>;
  onUndo?: () => Promise<void>;
  proposedBlocks: ScheduledBlockItem[];
  currentBlocks: Block[];
  subjects: Subject[];
  chapters: Chapter[];
  deficits: DeficitReport[];
  latestSnapshot?: ScheduleSnapshot | null;
  isApplying?: boolean;
}

export const SchedulePreviewModal: React.FC<SchedulePreviewModalProps> = ({
  isOpen,
  onClose,
  onApply,
  onUndo,
  proposedBlocks,
  currentBlocks,
  subjects,
  chapters,
  deficits,
  latestSnapshot,
  isApplying = false,
}) => {
  if (!isOpen) return null;

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));

  // Calculate diff statistics
  // Locked and completed blocks in currentBlocks
  const lockedCount = currentBlocks.filter((b) => b.is_locked).length;
  const completedCount = currentBlocks.filter((b) => b.status === 'done').length;

  // New blocks vs moved blocks
  const currentChapterDates = new Map<string, string[]>();
  currentBlocks.forEach((b) => {
    const list = currentChapterDates.get(b.chapter_id) || [];
    list.push(b.date);
    currentChapterDates.set(b.chapter_id, list);
  });

  let movedCount = 0;
  let newCount = 0;

  proposedBlocks.forEach((pb) => {
    if (pb.is_locked || pb.status === 'done') return;
    const existingDates = currentChapterDates.get(pb.chapter_id);
    if (!existingDates || existingDates.length === 0) {
      newCount++;
    } else if (!existingDates.includes(pb.date)) {
      movedCount++;
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Schedule Preview & Diff</h2>
              <p className="text-xs text-muted">
                Review proposed timetable adjustments before confirming.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-surface-2 border border-border text-center">
              <span className="text-xs font-semibold text-muted block">Moved</span>
              <span className="text-lg font-bold text-primary">{movedCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-2 border border-border text-center">
              <span className="text-xs font-semibold text-muted block">New Slots</span>
              <span className="text-lg font-bold text-mint">{newCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-2 border border-border text-center">
              <span className="text-xs font-semibold text-muted block">Locked Safe</span>
              <span className="text-lg font-bold text-ink">{lockedCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-2 border border-border text-center">
              <span className="text-xs font-semibold text-muted block">Done Kept</span>
              <span className="text-lg font-bold text-muted">{completedCount}</span>
            </div>
          </div>

          {/* Calm Deficit Banner if work won't fit */}
          {deficits.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Workload Alert</span>
              </div>
              {deficits.map((d) => (
                <p key={d.subject_id} className="text-xs leading-relaxed">
                  {d.message} We never overload your declared daily hours to compensate.
                </p>
              ))}
            </div>
          )}

          {/* Sample Change Items */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Proposed Schedule Plan ({proposedBlocks.length} sessions)
            </h4>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {proposedBlocks.slice(0, 15).map((block, idx) => {
                const subject = subjectMap.get(block.subject_id);
                const chapter = chapterMap.get(block.chapter_id);
                const reason = subject?.exam_date
                  ? `Optimized for ${subject.name} exam (${block.date})`
                  : 'Balanced pacing';

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {subject && (
                        <SubjectBadge
                          name={subject.name}
                          colorKey={subject.color_key}
                          size="sm"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">
                          {chapter?.title || block.chapter_title}
                        </p>
                        <p className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3 text-primary" />
                          <span>{block.date}</span>
                          <span>&bull;</span>
                          <span>{reason}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {block.is_locked ? (
                        <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-soft flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted px-2 py-0.5 rounded-full bg-surface-2">
                          {block.duration_min}m
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {proposedBlocks.length > 15 && (
                <p className="text-center text-xs text-muted py-1">
                  + {proposedBlocks.length - 15} more scheduled sessions
                </p>
              )}
            </div>
          </div>

          {/* Undo Snapshot Info */}
          {latestSnapshot && onUndo && (
            <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-ink">Previous Snapshot Available</p>
                <p className="text-muted text-[11px]">
                  Taken {new Date(latestSnapshot.created_at).toLocaleTimeString()} ({latestSnapshot.reason})
                </p>
              </div>
              <button
                type="button"
                onClick={onUndo}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-ink font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 1-Click Undo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-ink font-medium transition-colors"
          >
            Discard
          </button>

          <button
            type="button"
            disabled={isApplying}
            onClick={onApply}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {isApplying ? 'Applying...' : 'Apply Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
