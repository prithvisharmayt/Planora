import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Check,
  Sparkles,
} from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import { dataService } from '../lib/dataService';
import type { Block, Subject, Chapter } from '../types/database';

export interface PomodoroTimerProps {
  userId?: string;
  todayBlocks?: Block[];
  subjects?: Subject[];
  chapters?: Chapter[];
  onMarkBlockDone?: (block: Block) => Promise<void>;
  defaultSessionMin?: number;
  activeBlockId?: string;
  className?: string;
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

const STORAGE_KEY_STATE = 'planora_pomodoro_state';

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Pleasant three-tone chime (F5, A5, C6)
    const notes = [698.46, 880.0, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + 0.95);
    });
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  userId,
  todayBlocks = [],
  subjects = [],
  chapters = [],
  onMarkBlockDone,
  defaultSessionMin = 25,
  activeBlockId,
  className = '',
}) => {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [focusDuration, setFocusDuration] = useState(defaultSessionMin * 60);
  const [shortBreakDuration] = useState(5 * 60);
  const [longBreakDuration] = useState(15 * 60);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const getDuration = useCallback(
    (m: TimerMode) => {
      if (m === 'focus') return focusDuration;
      if (m === 'shortBreak') return shortBreakDuration;
      return longBreakDuration;
    },
    [focusDuration, shortBreakDuration, longBreakDuration]
  );

  const [timeLeft, setTimeLeft] = useState<number>(focusDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(activeBlockId || '');

  // Persistent target end timestamp for exact calculations
  const targetEndTimeRef = useRef<number | null>(null);
  const sessionStartTimestampRef = useRef<number | null>(null);

  // Sync activeBlockId prop if provided
  useEffect(() => {
    if (activeBlockId) {
      setSelectedBlockId(activeBlockId);
    }
  }, [activeBlockId]);

  // Adjust default session length if changed
  useEffect(() => {
    if (defaultSessionMin && defaultSessionMin > 0) {
      const sec = defaultSessionMin * 60;
      setFocusDuration(sec);
      if (mode === 'focus' && !isRunning) {
        setTimeLeft(sec);
      }
    }
  }, [defaultSessionMin, mode, isRunning]);

  // Auto-select first incomplete block for today
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

  // Restore saved state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.targetEndTime && saved.isRunning) {
          const remainingMs = saved.targetEndTime - Date.now();
          if (remainingMs > 0) {
            targetEndTimeRef.current = saved.targetEndTime;
            sessionStartTimestampRef.current = saved.sessionStartTimestamp || Date.now();
            setMode(saved.mode || 'focus');
            setTimeLeft(Math.ceil(remainingMs / 1000));
            setIsRunning(true);
            if (saved.selectedBlockId) setSelectedBlockId(saved.selectedBlockId);
          } else {
            // Already finished while tab was closed
            localStorage.removeItem(STORAGE_KEY_STATE);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isRunning && targetEndTimeRef.current) {
      localStorage.setItem(
        STORAGE_KEY_STATE,
        JSON.stringify({
          isRunning: true,
          mode,
          targetEndTime: targetEndTimeRef.current,
          sessionStartTimestamp: sessionStartTimestampRef.current,
          selectedBlockId,
        })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY_STATE);
    }
  }, [isRunning, mode, selectedBlockId]);

  // Log session to database
  const recordFocusSession = useCallback(
    async (durationSec: number) => {
      if (!userId || durationSec < 30) return;
      try {
        await dataService.logFocusSession({
          user_id: userId,
          chapter_id: activeChapter?.id || null,
          subject_id: activeSubject?.id || null,
          block_id: selectedBlock?.id || null,
          duration_sec: durationSec,
          session_type: mode === 'focus' ? 'pomodoro' : mode === 'shortBreak' ? 'short_break' : 'long_break',
        });
      } catch (err) {
        console.warn('Failed to record focus log:', err);
      }
    },
    [userId, activeChapter, activeSubject, selectedBlock, mode]
  );

  // Main countdown effect using timestamp difference (immune to tab throttling)
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const remainingMs = targetEndTimeRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(interval);
        setIsRunning(false);
        targetEndTimeRef.current = null;

        if (soundEnabled) {
          playChime();
        }

        // Record completed focus session
        if (mode === 'focus') {
          setCompletedSessions((c) => c + 1);
          recordFocusSession(focusDuration);
          setMode('shortBreak');
          setTimeLeft(shortBreakDuration);
        } else {
          setMode('focus');
          setTimeLeft(focusDuration);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, mode, soundEnabled, focusDuration, shortBreakDuration, recordFocusSession]);

  const toggleStartPause = () => {
    if (isRunning) {
      // Pause
      if (sessionStartTimestampRef.current) {
        const elapsedSec = Math.floor((Date.now() - sessionStartTimestampRef.current) / 1000);
        if (mode === 'focus' && elapsedSec >= 60) {
          recordFocusSession(elapsedSec);
        }
      }
      setIsRunning(false);
      targetEndTimeRef.current = null;
      sessionStartTimestampRef.current = null;
    } else {
      // Start
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      sessionStartTimestampRef.current = Date.now();
      setIsRunning(true);
    }
  };

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    sessionStartTimestampRef.current = null;
    setMode(newMode);
    setTimeLeft(getDuration(newMode));
  };

  const resetTimer = () => {
    setIsRunning(false);
    targetEndTimeRef.current = null;
    sessionStartTimestampRef.current = null;
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
      className={`rounded-2xl border transition-all ${
        isFullScreen
          ? 'fixed inset-0 z-50 bg-bg p-8 flex flex-col items-center justify-center'
          : `bg-surface border-border p-5 sm:p-6 shadow-sm ${className}`
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">Pomodoro Focus Timer</h3>
            <p className="text-[11px] text-muted">
              {completedSessions} focus session{completedSessions === 1 ? '' : 's'} completed today
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? 'Mute audio' : 'Enable audio'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted" />}
          </button>
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            aria-label={isFullScreen ? 'Exit full screen' : 'Full screen focus mode'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-center p-1 rounded-xl bg-surface-2 border border-border w-full max-w-xs mx-auto mb-5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => switchMode('focus')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            mode === 'focus' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Focus ({Math.floor(focusDuration / 60)}m)
        </button>
        <button
          type="button"
          onClick={() => switchMode('shortBreak')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            mode === 'shortBreak' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Break (5m)
        </button>
        <button
          type="button"
          onClick={() => switchMode('longBreak')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            mode === 'longBreak' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Long (15m)
        </button>
      </div>

      {/* Active Session Linked Block Selector */}
      {todayBlocks.length > 0 && (
        <div className="w-full max-w-md mx-auto mb-4 bg-surface-2/60 border border-border rounded-xl p-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted mb-1 px-1">
            <span>Targeting Today&apos;s Block</span>
            {selectedBlock?.status === 'done' && (
              <span className="text-mint font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Completed
              </span>
            )}
          </div>
          <select
            value={selectedBlockId}
            onChange={(e) => setSelectedBlockId(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg text-xs font-medium text-ink px-2.5 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value="">-- General Focus Session --</option>
            {todayBlocks.map((b) => {
              const ch = chapterMap.get(b.chapter_id);
              const sub = ch ? subjectMap.get(ch.subject_id) : undefined;
              return (
                <option key={b.id} value={b.id}>
                  {sub?.name || 'Subject'}: {ch?.title || 'Chapter'} ({b.duration_min}m) {b.status === 'done' ? '✓' : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Central Circular Progress Display */}
      <div className="relative flex items-center justify-center my-4">
        <svg className="w-56 h-56 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            className="stroke-surface-2"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            className="stroke-primary transition-all duration-300"
            strokeWidth="5"
            fill="transparent"
            strokeDasharray="283"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-ink">
            {timeFormatted}
          </span>
          <span className="text-xs uppercase font-bold tracking-widest text-primary mt-1">
            {mode === 'focus' ? 'Deep Work' : 'Break Time'}
          </span>
          {activeSubject && mode === 'focus' && (
            <div className="mt-2 max-w-[160px] truncate">
              <SubjectBadge name={activeSubject.name} colorKey={activeSubject.color_key} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <button
          type="button"
          onClick={resetTimer}
          aria-label="Reset timer"
          className="w-10 h-10 rounded-xl bg-surface-2 border border-border text-muted hover:text-ink flex items-center justify-center transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleStartPause}
          className="px-7 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 fill-current" /> Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" /> Start Focus
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (mode === 'focus') switchMode('shortBreak');
            else switchMode('focus');
          }}
          aria-label="Skip session"
          className="w-10 h-10 rounded-xl bg-surface-2 border border-border text-muted hover:text-ink flex items-center justify-center transition-colors"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Mark Block As Done shortcut */}
      {selectedBlock && selectedBlock.status !== 'done' && (
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-center">
          <button
            type="button"
            onClick={handleMarkBlockComplete}
            className="text-xs font-semibold text-mint hover:underline flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Mark current block as finished
          </button>
        </div>
      )}
    </div>
  );
};
