import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, Maximize2, Minimize2, Check, Sparkles } from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import type { Block, Subject, Chapter } from '../types/database';

export interface PomodoroTimerProps {
  todayBlocks?: Block[];
  subjects?: Subject[];
  chapters?: Chapter[];
  onMarkBlockDone?: (block: Block) => Promise<void>;
  defaultSessionMin?: number;
  className?: string;
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 chord
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 1.0);
    });
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  todayBlocks = [],
  subjects = [],
  chapters = [],
  onMarkBlockDone,
  defaultSessionMin = 25,
  className = '',
}) => {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [focusDuration, setFocusDuration] = useState(defaultSessionMin * 60);
  const [shortBreakDuration] = useState(5 * 60);
  const [longBreakDuration] = useState(15 * 60);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const getDuration = useCallback((m: TimerMode) => {
    if (m === 'focus') return focusDuration;
    if (m === 'shortBreak') return shortBreakDuration;
    return longBreakDuration;
  }, [focusDuration, shortBreakDuration, longBreakDuration]);

  const [timeLeft, setTimeLeft] = useState<number>(focusDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (defaultSessionMin && defaultSessionMin > 0) {
      setFocusDuration(defaultSessionMin * 60);
      if (mode === 'focus' && !isRunning) {
        setTimeLeft(defaultSessionMin * 60);
      }
    }
  }, [defaultSessionMin, mode, isRunning]);

  useEffect(() => {
    if (!selectedBlockId && todayBlocks.length > 0) {
      const firstIncomplete = todayBlocks.find((b) => b.status !== 'done');
      if (firstIncomplete) {
        setSelectedBlockId(firstIncomplete.id);
      }
    }
  }, [todayBlocks, selectedBlockId]);

  const selectedBlock = todayBlocks.find((b) => b.id === selectedBlockId);
  const activeChapter = selectedBlock ? chapterMap.get(selectedBlock.chapter_id) : null;
  const activeSubject = activeChapter ? subjectMap.get(activeChapter.subject_id) : null;

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            if (soundEnabled) {
              playChime();
            }

            if (mode === 'focus') {
              setCompletedSessions((c) => c + 1);
              setMode('shortBreak');
              return shortBreakDuration;
            } else {
              setMode('focus');
              return focusDuration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, soundEnabled, focusDuration, shortBreakDuration]);

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(getDuration(newMode));
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(getDuration(mode));
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const currentDuration = getDuration(mode);
  const progressPercent = Math.min(100, Math.max(0, ((currentDuration - timeLeft) / currentDuration) * 100));
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;

  const handleMarkBlockComplete = async () => {
    if (selectedBlock && onMarkBlockDone) {
      await onMarkBlockDone(selectedBlock);
    }
  };

  return (
    <div
      className={`rounded-card border transition-all ${
        isFullScreen
          ? 'fixed inset-0 z-50 bg-bg p-8 flex flex-col items-center justify-center'
          : `bg-surface border-border p-5 shadow-card ${className}`
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">Pomodoro Focus Timer</h3>
            <p className="text-[11px] text-muted">
              {completedSessions} focus session{completedSessions === 1 ? '' : 's'} completed today
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-dim" />}
          </button>
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            aria-label={isFullScreen ? 'Exit full screen' : 'Full screen focus mode'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-center p-1 rounded-pill bg-surface-2 border border-border w-full max-w-xs mx-auto mb-5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => switchMode('focus')}
          className={`flex-1 py-1.5 rounded-pill transition-all ${
            mode === 'focus'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Focus
        </button>
        <button
          type="button"
          onClick={() => switchMode('shortBreak')}
          className={`flex-1 py-1.5 rounded-pill transition-all ${
            mode === 'shortBreak'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Short Break
        </button>
        <button
          type="button"
          onClick={() => switchMode('longBreak')}
          className={`flex-1 py-1.5 rounded-pill transition-all ${
            mode === 'longBreak'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Long Break
        </button>
      </div>

      {/* Circular Timer Display */}
      <div className="flex flex-col items-center justify-center my-3 relative">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="transparent"
              stroke="var(--surface-2)"
              strokeWidth="6"
            />
            {/* Progress ring with light blue accent */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="transparent"
              stroke="var(--primary)"
              strokeWidth="6"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-linear"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-heading font-bold text-3xl text-ink tracking-tight">
              {timeFormatted}
            </span>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider mt-1">
              {mode === 'focus' ? 'Deep Work' : mode === 'shortBreak' ? 'Short Rest' : 'Long Rest'}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Study Block (Optional) */}
      {todayBlocks.length > 0 && mode === 'focus' && (
        <div className="my-3 p-3 rounded-card bg-surface-2/60 border border-border w-full max-w-sm mx-auto">
          <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
            Link to Scheduled Block
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="flex-1 text-xs bg-surface border border-border rounded-input px-2.5 py-1.5 text-ink focus:border-primary truncate"
            >
              <option value="">No block linked (General Study)</option>
              {todayBlocks.map((b) => {
                const ch = chapterMap.get(b.chapter_id);
                return (
                  <option key={b.id} value={b.id}>
                    {ch?.title || 'Chapter Study'} {b.status === 'done' ? '✓' : ''}
                  </option>
                );
              })}
            </select>

            {selectedBlock && selectedBlock.status !== 'done' && onMarkBlockDone && (
              <button
                type="button"
                onClick={handleMarkBlockComplete}
                title="Mark this block as completed"
                className="px-2.5 py-1.5 rounded-input bg-mint-soft text-mint border border-mint/30 hover:bg-mint hover:text-white transition-colors text-xs font-semibold flex items-center gap-1 flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            )}
          </div>

          {activeSubject && activeChapter && (
            <div className="mt-2 flex items-center gap-2">
              <SubjectBadge name={activeSubject.name} colorKey={activeSubject.color_key as any} size="sm" />
              <span className="text-xs text-ink font-medium truncate">{activeChapter.title}</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={resetTimer}
          aria-label="Reset timer"
          className="w-10 h-10 rounded-full border border-border bg-surface-2 hover:bg-slate-200 text-muted hover:text-ink flex items-center justify-center transition-colors pressable"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsRunning(!isRunning)}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          className="px-6 py-2.5 rounded-pill bg-ink text-white hover:bg-slate-800 font-semibold text-xs flex items-center gap-2 transition-colors pressable shadow-sm"
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Focus</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRunning(false);
            if (mode === 'focus') {
              switchMode('shortBreak');
            } else {
              switchMode('focus');
            }
          }}
          aria-label="Skip to next session"
          className="w-10 h-10 rounded-full border border-border bg-surface-2 hover:bg-slate-200 text-muted hover:text-ink flex items-center justify-center transition-colors pressable"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
