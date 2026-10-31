import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  Upload,
  Trash2,
  Calendar,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  Edit2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { SubjectBadge, subjectColorMap } from '../components/SubjectBadge';
import { WeekTimetable } from '../components/WeekTimetable';
import { WeeklyListView } from '../components/WeeklyListView';
import { SchedulePreviewModal } from '../components/SchedulePreviewModal';
import { PdfSyllabusModal } from '../components/PdfSyllabusModal';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { Modal } from '../components/Modal';
import { Seo } from '../components/Seo';
import { generateSchedule, type ScheduledBlockItem, type DeficitReport, formatDate, addDays } from '../lib/scheduler';
import type { Subject, Chapter, Block, AcademicEvent, ScheduleSnapshot, TopicStatus } from '../types/database';

export const PlanPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<ScheduleSnapshot | null>(null);

  // View mode: Visual Week or Weekly List
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Modals state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [proposedBlocks, setProposedBlocks] = useState<ScheduledBlockItem[]>([]);
  const [schedulerDeficits, setSchedulerDeficits] = useState<DeficitReport[]>([]);
  const [isApplyingSchedule, setIsApplyingSchedule] = useState(false);

  // Active pomodoro block modal
  const [pomodoroTargetBlock, setPomodoroTargetBlock] = useState<Block | null>(null);

  // Edit Subject Modal state
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSubjectExamDate, setEditSubjectExamDate] = useState('');
  const [editSubjectPriority, setEditSubjectPriority] = useState(2);
  const [editSubjectConfidence, setEditSubjectConfidence] = useState<1 | 2 | 3>(2);

  // Manual chapter entry in subject detail
  const [addingToSubjectId, setAddingToSubjectId] = useState<string | null>(null);
  const [chapterEntryMode, setChapterEntryMode] = useState<'single' | 'paste' | 'upload'>('single');
  const [singleTitle, setSingleTitle] = useState('');
  const [singleUnit, setSingleUnit] = useState('');
  const [singleEstMin, setSingleEstMin] = useState(60);
  const [pasteText, setPasteText] = useState('');
  const [parsedReviewList, setParsedReviewList] = useState<Array<{ title: string; est_min: number }>>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [subs, chaps, blks, evts, snap] = await Promise.all([
        dataService.getSubjects(user.id),
        dataService.getChapters(user.id),
        dataService.getBlocks(user.id),
        dataService.getAcademicEvents(user.id),
        dataService.getLatestSnapshot(user.id),
      ]);
      setSubjects(subs);
      setChapters(chaps);
      setBlocks(blks);
      setEvents(evts);
      setLatestSnapshot(snap);

      if (subs.length > 0 && !expandedSubjectId) {
        setExpandedSubjectId(subs[0].id);
      }
    } catch (err) {
      console.error('Failed to load plan data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, expandedSubjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // Calculate subject progress statistics
  const subjectProgress = useMemo(() => {
    const map = new Map<
      string,
      { totalMin: number; doneMin: number; percent: number; totalChapters: number; doneChapters: number }
    >();

    subjects.forEach((s) => {
      const subChapters = chapters.filter((c) => c.subject_id === s.id);
      const totalMin = subChapters.reduce((acc, c) => acc + c.est_min, 0);

      const subBlocks = blocks.filter((b) => {
        const ch = chapterMap.get(b.chapter_id);
        return ch && ch.subject_id === s.id && b.status === 'done';
      });
      const doneMin = subBlocks.reduce((acc, b) => acc + b.duration_min, 0);
      const doneChapters = subChapters.filter((c) => c.is_done).length;

      const percent = totalMin > 0 ? Math.min(100, Math.round((doneMin / totalMin) * 100)) : 0;
      map.set(s.id, {
        totalMin,
        doneMin,
        percent,
        totalChapters: subChapters.length,
        doneChapters,
      });
    });

    return map;
  }, [subjects, chapters, blocks, chapterMap]);

  // Toggle block status
  const handleToggleBlockStatus = async (block: Block, targetStatus: 'done' | 'scheduled') => {
    try {
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, status: targetStatus } : b))
      );
      await dataService.updateBlockStatus(block.id, targetStatus);
    } catch (err) {
      console.error('Failed to update block status:', err);
      loadData();
    }
  };

  // Toggle block locked state
  const handleToggleLockBlock = async (block: Block) => {
    try {
      const newLocked = !block.is_locked;
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, is_locked: newLocked } : b))
      );
      await dataService.updateBlock(block.id, { is_locked: newLocked });
      showToast(newLocked ? 'Session locked in schedule' : 'Session unlocked');
    } catch (err) {
      console.error('Failed to toggle block lock:', err);
      loadData();
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
      showToast(`Moved session to ${nextDate}`);
    } catch (err) {
      console.error('Failed to move block:', err);
      loadData();
    }
  };


  // Cycle topic status: not_started -> learning -> revising -> completed
  const handleCycleTopicStatus = async (chapter: Chapter) => {
    const cycleMap: Record<TopicStatus, TopicStatus> = {
      not_started: 'learning',
      learning: 'revising',
      revising: 'completed',
      completed: 'not_started',
    };
    const current = chapter.status || (chapter.is_done ? 'completed' : 'not_started');
    const next = cycleMap[current];
    const isDone = next === 'completed';

    try {
      setChapters((prev) =>
        prev.map((c) => (c.id === chapter.id ? { ...c, status: next, is_done: isDone } : c))
      );
      await dataService.updateChapter(chapter.id, { status: next, is_done: isDone });
    } catch (err) {
      console.error('Failed to update topic status:', err);
      loadData();
    }
  };

  // Delete chapter
  const handleDeleteChapter = async (chapterId: string) => {
    if (!user || !window.confirm('Delete this chapter and its scheduled study sessions?')) return;
    try {
      await dataService.deleteChapter(chapterId, user.id);
      setChapters((prev) => prev.filter((c) => c.id !== chapterId));
      setBlocks((prev) => prev.filter((b) => b.chapter_id !== chapterId));
      showToast('Chapter deleted');
    } catch (err) {
      console.error('Failed to delete chapter:', err);
    }
  };

  // Delete subject
  const handleDeleteSubject = async (subjectId: string) => {
    if (!user || !window.confirm('Delete this subject, all its chapters, and associated study sessions?')) return;
    try {
      await dataService.deleteSubject(subjectId, user.id);
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      setChapters((prev) => prev.filter((c) => c.subject_id !== subjectId));
      setBlocks((prev) => prev.filter((b) => b.subject_id !== subjectId));
      showToast('Subject deleted');
    } catch (err) {
      console.error('Failed to delete subject:', err);
    }
  };

  // Edit subject
  const openEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setEditSubjectName(sub.name);
    setEditSubjectCode(sub.code || '');
    setEditSubjectExamDate(sub.exam_date || '');
    setEditSubjectPriority(sub.priority || 2);
    setEditSubjectConfidence(sub.confidence || 2);
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubject || !editSubjectName.trim()) return;
    try {
      const updates = {
        name: editSubjectName.trim(),
        code: editSubjectCode.trim() || null,
        exam_date: editSubjectExamDate.trim() || null,
        priority: editSubjectPriority,
        confidence: editSubjectConfidence,
      };
      await dataService.updateSubject(editingSubject.id, updates);
      setSubjects((prev) =>
        prev.map((s) => (s.id === editingSubject.id ? { ...s, ...updates } : s))
      );
      setEditingSubject(null);
      showToast('Subject details updated');
    } catch (err) {
      console.error('Failed to update subject:', err);
    }
  };

  // Prepare Schedule Regeneration Preview
  const handleStartRegenerate = async () => {
    if (!user) return;
    try {
      const profile = await dataService.getProfile(user.id);
      const dailyHours = profile?.daily_hours || 3;
      const sessionMin = profile?.session_min || 45;
      const breakMin = profile?.break_min ?? 10;
      const todayStr = formatDate(new Date());

      const res = generateSchedule({
        subjects,
        chapters,
        config: {
          daily_hours: dailyHours,
          session_min: sessionMin,
          break_min: breakMin,
          start_date: todayStr,
        },
        existing_blocks: blocks,
        academic_events: events,
      });

      setProposedBlocks(res.blocks);
      setSchedulerDeficits(res.deficits);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      console.error('Failed to generate schedule proposal:', err);
      setErrorMsg('Could not calculate schedule proposal.');
    }
  };

  // Apply Regenerated Schedule
  const handleApplySchedule = async () => {
    if (!user) return;
    setIsApplyingSchedule(true);
    try {
      const todayStr = formatDate(new Date());

      // 1. Take atomic snapshot before altering schedule
      await dataService.saveSnapshot(
        user.id,
        JSON.stringify(blocks),
        'Pre-regeneration snapshot'
      );

      // 2. Prepare new blocks without un-locked scheduled ones
      const newBlockPayload = proposedBlocks
        .filter((b) => !b.is_locked)
        .map((b) => ({
          user_id: user.id,
          chapter_id: b.chapter_id,
          subject_id: b.subject_id,
          date: b.date,
          start_min: b.start_min,
          duration_min: b.duration_min,
          status: 'scheduled' as const,
          is_locked: false,
        }));

      // 3. Replace incomplete blocks from today onward
      await dataService.replaceIncompleteBlocks(user.id, todayStr, newBlockPayload);

      // Reload fresh data
      await loadData();
      setIsPreviewModalOpen(false);
      showToast(`Schedule generated and updated successfully!`);
    } catch (err: any) {
      console.error('Failed to apply schedule:', err);
      setErrorMsg('Failed to apply regenerated schedule.');
    } finally {
      setIsApplyingSchedule(false);
    }
  };

  // 1-Click Atomic Undo
  const handleUndoSchedule = async () => {
    if (!user || !latestSnapshot) return;
    try {
      await dataService.restoreSnapshot(latestSnapshot.id, user.id);
      await loadData();
      setIsPreviewModalOpen(false);
      showToast('Timetable restored to previous snapshot.');
    } catch (err: any) {
      console.error('Failed to undo schedule:', err);
      setErrorMsg('Could not restore timetable snapshot.');
    }
  };

  // Manual chapter parsing helper
  const parseLinesToChapters = (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((l) => l.length > 0);

    const uniqueLines = Array.from(new Set(lines)).slice(0, 60);
    return uniqueLines.map((title) => ({ title, est_min: 60 }));
  };

  // Add single chapter to subject
  const handleAddSingleChapter = async (subjectId: string) => {
    if (!user || !singleTitle.trim()) return;
    try {
      const targetSub = subjects.find((s) => s.id === subjectId);
      const existingForSub = chapters.filter((c) => c.subject_id === subjectId);
      const newCh = await dataService.createChapters([
        {
          user_id: user.id,
          subject_id: subjectId,
          unit_title: singleUnit.trim() || null,
          title: singleTitle.trim(),
          est_min: singleEstMin,
          is_done: false,
          status: 'not_started',
          position: existingForSub.length + 1,
        },
      ]);
      setChapters([...chapters, ...newCh]);
      setSingleTitle('');
      setSingleUnit('');
      setAddingToSubjectId(null);
      showToast(`Added chapter to ${targetSub?.name || 'subject'}.`);
    } catch (err) {
      console.error('Failed to add chapter:', err);
    }
  };

  // Text file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setIsPdfModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const items = parseLinesToChapters(content);
      if (items.length === 0) {
        setErrorMsg('No chapter lines found in file.');
        return;
      }
      setParsedReviewList(items);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  // Save parsed chapters
  const handleSaveParsedChapters = async (subjectId: string) => {
    if (!user || parsedReviewList.length === 0) return;
    try {
      const targetSub = subjects.find((s) => s.id === subjectId);
      const existingForSub = chapters.filter((c) => c.subject_id === subjectId);

      const toCreate = parsedReviewList.map((item, idx) => ({
        user_id: user.id,
        subject_id: subjectId,
        title: item.title,
        est_min: item.est_min || 60,
        is_done: false,
        status: 'not_started' as const,
        position: existingForSub.length + idx + 1,
      }));

      const created = await dataService.createChapters(toCreate);
      setChapters([...chapters, ...created]);
      setParsedReviewList([]);
      setPasteText('');
      setAddingToSubjectId(null);
      showToast(`Added ${created.length} chapters to ${targetSub?.name || 'subject'}.`);
    } catch (err) {
      console.error('Failed to import parsed chapters:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-muted mt-3">Loading your study roadmap...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <Seo
        title="My Plan — Weekly Schedule & Syllabus"
        description="Inspect your visual timetable, weekly study plan, and subject syllabus breakdown."
        noIndex={true}
        canonicalPath="/plan"
      />

      {/* Page Header with Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Study Schedule & Syllabus
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Synchronized visual timetable, weekly list, and subject breakdown.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* PDF Import Button */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Import PDF Syllabus</span>
          </button>

          {/* Regenerate Schedule Button */}
          <button
            type="button"
            onClick={handleStartRegenerate}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Regenerate Schedule</span>
          </button>
        </div>
      </div>

      {/* Global Toast / Alerts */}
      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-mint-soft border border-mint/30 text-mint text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SCHEDULE VIEW CONTROLS & TIMETABLE SECTION */}
      <section aria-labelledby="schedule-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 id="schedule-heading" className="font-heading font-bold text-lg text-ink">
              Weekly Timetable
            </h2>
            <span className="text-xs text-muted">
              ({blocks.length} scheduled session{blocks.length === 1 ? '' : 's'})
            </span>
          </div>

          {/* Synchronized View Switcher: Visual Week vs Weekly List */}
          <div className="flex items-center p-1 rounded-xl bg-surface-2 border border-border text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'visual'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Visual Week</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Weekly List</span>
            </button>
          </div>
        </div>

        {/* Schedule Display */}
        {viewMode === 'visual' ? (
          <WeekTimetable
            subjects={subjects}
            chapters={chapters}
            blocks={blocks}
            onToggleBlockStatus={handleToggleBlockStatus}
            onToggleLockBlock={handleToggleLockBlock}
            onMoveBlockToTomorrow={handleMoveBlockToTomorrow}
            onStartPomodoroForBlock={(block) => setPomodoroTargetBlock(block)}
          />
        ) : (
          <WeeklyListView
            subjects={subjects}
            chapters={chapters}
            blocks={blocks}
            onToggleBlockStatus={handleToggleBlockStatus}
            onToggleLockBlock={handleToggleLockBlock}
            onMoveBlockToTomorrow={handleMoveBlockToTomorrow}
            onStartPomodoroForBlock={(block) => setPomodoroTargetBlock(block)}
          />
        )}
      </section>

      {/* SUBJECT / CHAPTER LIST WITH CONFIDENCE, TOPIC STATUS, & MANUAL ENTRY */}
      <section aria-labelledby="subjects-heading" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="subjects-heading" className="font-heading font-bold text-lg text-ink">
              Subjects & Syllabus Breakdown
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Review syllabus topics, track mastery stages, and manage chapters.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Subject
          </button>
        </div>

        <div className="space-y-4">
          {subjects.map((sub) => {
            const stats = subjectProgress.get(sub.id) || {
              totalMin: 0,
              doneMin: 0,
              percent: 0,
              totalChapters: 0,
              doneChapters: 0,
            };
            const isExpanded = expandedSubjectId === sub.id;
            const subChapters = chapters.filter((c) => c.subject_id === sub.id);
            const isAdding = addingToSubjectId === sub.id;

            return (
              <div
                key={sub.id}
                className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
              >
                {/* Subject Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SubjectBadge name={sub.name} colorKey={sub.color_key} size="md" />
                    {sub.code && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 text-muted font-medium">
                        {sub.code}
                      </span>
                    )}
                    <span className="text-xs text-muted flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {sub.exam_date ? `Exam: ${sub.exam_date}` : 'No exam set'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs font-semibold text-ink">
                      {stats.percent}% ({Math.round(stats.doneMin / 60)}h / {Math.round(stats.totalMin / 60)}h)
                    </span>

                    {/* Edit Subject Button */}
                    <button
                      type="button"
                      onClick={() => openEditSubject(sub)}
                      aria-label={`Edit ${sub.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Subject Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(sub.id)}
                      aria-label={`Delete ${sub.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Expand/Collapse Chevron */}
                    <button
                      type="button"
                      onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sub.name} chapters`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stats.percent}%`,
                      backgroundColor: subjectColorMap[sub.color_key]?.hex || '#2563EB',
                    }}
                  />
                </div>

                {/* Expanded Chapters Table & Add Options */}
                {isExpanded && (
                  <div className="pt-3 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Chapters & Topics ({subChapters.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingToSubjectId(isAdding ? null : sub.id);
                          setParsedReviewList([]);
                        }}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAdding ? 'Close entry' : 'Add topics'}</span>
                      </button>
                    </div>

                    {/* Chapter Entry Container when active */}
                    {isAdding && (
                      <div className="p-4 rounded-xl bg-surface-2/60 border border-border space-y-3">
                        <div className="flex border-b border-border text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => { setChapterEntryMode('single'); setParsedReviewList([]); }}
                            className={`pb-2 px-2.5 border-b-2 transition-colors flex items-center gap-1 ${
                              chapterEntryMode === 'single' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>One at a time</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setChapterEntryMode('paste'); setParsedReviewList([]); }}
                            className={`pb-2 px-2.5 border-b-2 transition-colors flex items-center gap-1 ${
                              chapterEntryMode === 'paste' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Paste syllabus</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setChapterEntryMode('upload'); setParsedReviewList([]); }}
                            className={`pb-2 px-2.5 border-b-2 transition-colors flex items-center gap-1 ${
                              chapterEntryMode === 'upload' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                            }`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload (.txt, .csv)</span>
                          </button>
                        </div>

                        {/* Mode 1: Single */}
                        {chapterEntryMode === 'single' && (
                          <div className="space-y-2.5 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={singleUnit}
                                onChange={(e) => setSingleUnit(e.target.value)}
                                placeholder="Unit name (Optional)"
                                className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-xs focus:border-primary"
                              />
                              <input
                                type="text"
                                value={singleTitle}
                                onChange={(e) => setSingleTitle(e.target.value)}
                                placeholder="Topic / Chapter title"
                                className="sm:col-span-2 px-3 py-2 rounded-lg border border-border bg-surface text-ink text-xs focus:border-primary"
                              />
                            </div>
                            <div className="flex gap-2">
                              {[30, 45, 60, 90, 120].map((mins) => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setSingleEstMin(mins)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                                    singleEstMin === mins
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-surface text-muted border-border hover:border-primary/40'
                                  }`}
                                >
                                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddSingleChapter(sub.id)}
                              className="w-full py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-sm"
                            >
                              Add to {sub.name}
                            </button>
                          </div>
                        )}

                        {/* Mode 2: Paste */}
                        {chapterEntryMode === 'paste' && parsedReviewList.length === 0 && (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={4}
                              value={pasteText}
                              onChange={(e) => setPasteText(e.target.value)}
                              placeholder="Paste your syllabus — one chapter per line."
                              className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:border-primary font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const items = parseLinesToChapters(pasteText);
                                if (items.length > 0) setParsedReviewList(items);
                              }}
                              className="w-full py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-sm"
                            >
                              Review Chapters
                            </button>
                          </div>
                        )}

                        {/* Mode 3: Upload */}
                        {chapterEntryMode === 'upload' && parsedReviewList.length === 0 && (
                          <div className="p-4 rounded-xl border-2 border-dashed border-border text-center bg-surface">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".txt,.csv,.pdf"
                              onChange={handleFileUpload}
                              className="hidden"
                              id={`file-up-${sub.id}`}
                            />
                            <label
                              htmlFor={`file-up-${sub.id}`}
                              className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Select .txt, .csv, or PDF document</span>
                            </label>
                          </div>
                        )}

                        {/* Review List */}
                        {parsedReviewList.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted">
                              <span>{parsedReviewList.length} chapters to import</span>
                              <button
                                type="button"
                                onClick={() => setParsedReviewList([])}
                                className="hover:text-ink"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {parsedReviewList.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={it.title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setParsedReviewList((prev) =>
                                        prev.map((c, i) => (i === idx ? { ...c, title: val } : c))
                                      );
                                    }}
                                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-ink text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setParsedReviewList((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-muted hover:text-danger p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveParsedChapters(sub.id)}
                              className="w-full py-2 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary-hover"
                            >
                              Save {parsedReviewList.length} Chapters
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chapters List */}
                    {subChapters.length === 0 ? (
                      <p className="text-xs text-muted py-4 text-center">
                        No chapters yet — add your first one above or import a syllabus.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {subChapters.map((ch, idx) => {
                          const topicStatus = ch.status || (ch.is_done ? 'completed' : 'not_started');

                          return (
                            <div
                              key={ch.id}
                              className="p-3 rounded-xl bg-surface-2/40 border border-border flex items-center justify-between gap-3 text-sm hover:bg-surface-2 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Interactive Topic Status Tick Box */}
                                <button
                                  type="button"
                                  onClick={() => handleCycleTopicStatus(ch)}
                                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                                    topicStatus === 'completed'
                                      ? 'bg-mint text-white border-mint shadow-sm'
                                      : topicStatus === 'revising'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : topicStatus === 'learning'
                                      ? 'bg-primary-soft text-primary border-primary/30'
                                      : 'bg-surface border-border text-transparent hover:border-primary'
                                  }`}
                                  title={`Status: ${topicStatus} (Click to advance)`}
                                  aria-label={`Mark status of ${ch.title}`}
                                >
                                  {topicStatus === 'completed' ? (
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  ) : topicStatus === 'revising' ? (
                                    <span className="text-[10px] font-bold">R</span>
                                  ) : topicStatus === 'learning' ? (
                                    <span className="text-[10px] font-bold">L</span>
                                  ) : null}
                                </button>

                                <span className="text-xs font-bold text-muted">{idx + 1}.</span>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {ch.unit_title && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                                        {ch.unit_title}
                                      </span>
                                    )}
                                    <span
                                      className={`text-xs font-semibold text-ink truncate ${
                                        ch.is_done ? 'line-through text-muted' : ''
                                      }`}
                                    >
                                      {ch.title}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted font-medium">
                                  {ch.est_min}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChapter(ch.id)}
                                  className="p-1 text-muted hover:text-danger rounded-lg transition-colors"
                                  title="Delete chapter"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* PDF SYLLABUS MODAL */}
      <PdfSyllabusModal
        userId={user?.id || ''}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        existingSubjects={subjects}
        onImportComplete={async () => {
          await loadData();
          showToast('Syllabus and academic dates imported successfully!');
        }}
      />

      {/* SCHEDULE REGENERATION PREVIEW MODAL */}
      <SchedulePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        onApply={handleApplySchedule}
        onUndo={latestSnapshot ? handleUndoSchedule : undefined}
        proposedBlocks={proposedBlocks}
        currentBlocks={blocks}
        subjects={subjects}
        chapters={chapters}
        deficits={schedulerDeficits}
        latestSnapshot={latestSnapshot}
        isApplying={isApplyingSchedule}
      />

      {/* EDIT SUBJECT MODAL */}
      {editingSubject && (
        <Modal
          isOpen={Boolean(editingSubject)}
          onClose={() => setEditingSubject(null)}
          title="Edit Subject"
          description="Update course details, code, and exam deadline."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Subject Name
              </label>
              <input
                type="text"
                value={editSubjectName}
                onChange={(e) => setEditSubjectName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl text-ink focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Course Code (Optional)
              </label>
              <input
                type="text"
                value={editSubjectCode}
                onChange={(e) => setEditSubjectCode(e.target.value)}
                placeholder="e.g. CS101, CHEM201"
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl text-ink focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Exam Date
              </label>
              <input
                type="date"
                value={editSubjectExamDate}
                onChange={(e) => setEditSubjectExamDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-xl text-ink focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubject}
                className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* TARGET POMODORO MODAL */}
      {pomodoroTargetBlock && (
        <Modal
          isOpen={Boolean(pomodoroTargetBlock)}
          onClose={() => setPomodoroTargetBlock(null)}
          title="Deep Focus Session"
          description="Focus cycle with live countdown and audio chime."
          maxWidth="max-w-lg"
        >
          <PomodoroTimer
            userId={user?.id}
            todayBlocks={blocks.filter((b) => b.date === formatDate(new Date()))}
            subjects={subjects}
            chapters={chapters}
            activeBlockId={pomodoroTargetBlock.id}
            onMarkBlockDone={async (blk) => {
              await handleToggleBlockStatus(blk, 'done');
              setPomodoroTargetBlock(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};
