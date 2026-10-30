import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, FileText, Upload, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { SubjectBadge } from '../components/SubjectBadge';
import { WeekTimetable } from '../components/WeekTimetable';
import { Seo } from '../components/Seo';
import type { Subject, Chapter, Block } from '../types/database';

export const PlanPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Manual chapter entry in subject detail
  const [addingToSubjectId, setAddingToSubjectId] = useState<string | null>(null);
  const [chapterEntryMode, setChapterEntryMode] = useState<'single' | 'paste' | 'upload'>('single');
  const [singleTitle, setSingleTitle] = useState('');
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
      const [subs, chaps, blks] = await Promise.all([
        dataService.getSubjects(user.id),
        dataService.getChapters(user.id),
        dataService.getBlocks(user.id),
      ]);
      setSubjects(subs);
      setChapters(chaps);
      setBlocks(blks);
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

  // Toggle block status from timetable
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

  // Toggle chapter done status
  const handleToggleChapter = async (chapter: Chapter) => {
    try {
      const newDone = !chapter.is_done;
      setChapters((prev) =>
        prev.map((c) => (c.id === chapter.id ? { ...c, is_done: newDone } : c))
      );
      await dataService.updateChapter(chapter.id, { is_done: newDone });
    } catch (err) {
      console.error('Failed to toggle chapter:', err);
      loadData();
    }
  };

  // Parsing helper
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
          title: singleTitle.trim(),
          est_min: singleEstMin,
          is_done: false,
          position: existingForSub.length + 1,
        },
      ]);
      setChapters([...chapters, ...newCh]);
      setSingleTitle('');
      setAddingToSubjectId(null);
      showToast(`Added chapter to ${targetSub?.name || 'subject'}.`);
    } catch (err) {
      console.error('Failed to add chapter:', err);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg("PDFs aren't supported yet — paste the text instead.");
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
    <div className="space-y-10">
      <Seo
        title="My Plan — Weekly Timetable & Syllabus"
        description="Inspect your visual timetable and subject-by-subject revision syllabus."
        noIndex={true}
        canonicalPath="/plan"
      />

      {/* Page Title */}
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
          My Plan
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Visual weekly roadmap and chapter syllabus breakdown.
        </p>
      </div>

      {/* Global Toast */}
      {toastMsg && (
        <div className="p-3.5 rounded-input bg-mint-soft border border-mint/30 text-mint text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-input bg-rose/10 border border-rose/30 text-rose text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PRIMARY CONTENT: VISUAL TIMETABLE (Centrepiece - Change 5) */}
      <section aria-labelledby="timetable-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="timetable-heading" className="font-heading font-bold text-xl text-ink">
            Weekly Schedule
          </h2>
          <span className="text-xs text-muted">
            06:00 – 23:00 timeline
          </span>
        </div>

        <WeekTimetable
          subjects={subjects}
          chapters={chapters}
          blocks={blocks}
          onToggleBlockStatus={handleToggleBlockStatus}
        />
      </section>

      {/* SUBJECT / CHAPTER LIST WITH PER-SUBJECT PROGRESS & MANUAL ENTRY */}
      <section aria-labelledby="subjects-heading" className="space-y-4">
        <div>
          <h2 id="subjects-heading" className="font-heading font-bold text-xl text-ink">
            Subjects & Syllabus Details
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Manage your chapters, add new topics, and track completion.
          </p>
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
                className="bg-surface border border-border rounded-card p-5 sm:p-6 shadow-card space-y-4"
              >
                {/* Subject Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <SubjectBadge name={sub.name} colorKey={sub.color_key} size="md" />
                    <span className="text-xs text-muted flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue" />
                      {sub.exam_date ? `Exam: ${sub.exam_date}` : 'No exam date set'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs font-semibold text-ink">
                      {stats.percent}% ({Math.round(stats.doneMin / 60)}h / {Math.round(stats.totalMin / 60)}h)
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sub.name} chapters`}
                      className="w-9 h-9 flex items-center justify-center rounded-input text-muted hover:text-ink hover:bg-surface-2 transition-colors pressable"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Subject Progress Bar (Gradient #2DD4A7 -> #4EA8FF) */}
                <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stats.percent}%`,
                      background: 'linear-gradient(90deg, #2DD4A7 0%, #4EA8FF 100%)',
                    }}
                  />
                </div>

                {/* Expanded Chapters Table & Add Options */}
                {isExpanded && (
                  <div className="pt-2 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Chapters ({subChapters.length})
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
                        <span>{isAdding ? 'Close chapter entry' : 'Add chapters'}</span>
                      </button>
                    </div>

                    {/* Chapter Entry Container when active */}
                    {isAdding && (
                      <div className="p-4 rounded-input bg-surface-2 border border-border space-y-3">
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
                            <input
                              type="text"
                              value={singleTitle}
                              onChange={(e) => setSingleTitle(e.target.value)}
                              placeholder="Chapter title"
                              className="w-full px-3 py-2 rounded-input border border-border bg-surface text-ink text-sm focus:border-primary"
                            />
                            <div className="flex gap-2">
                              {[30, 60, 120].map((mins) => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setSingleEstMin(mins)}
                                  className={`flex-1 py-1.5 rounded-input text-xs font-semibold border ${
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
                              className="w-full py-2 rounded-input bg-primary text-white text-xs font-semibold shadow-cta hover:bg-primary-hi"
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
                              className="w-full px-3 py-2 rounded-input border border-border bg-surface text-ink text-xs focus:border-primary font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const items = parseLinesToChapters(pasteText);
                                if (items.length > 0) setParsedReviewList(items);
                              }}
                              className="w-full py-2 rounded-input bg-primary text-white text-xs font-semibold shadow-cta hover:bg-primary-hi"
                            >
                              Review Chapters
                            </button>
                          </div>
                        )}

                        {/* Mode 3: Upload */}
                        {chapterEntryMode === 'upload' && parsedReviewList.length === 0 && (
                          <div className="p-4 rounded border-2 border-dashed border-border text-center bg-surface">
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
                              <span>Select .txt or .csv file</span>
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
                            <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
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
                                    className="flex-1 px-2 py-1 rounded bg-surface border border-border text-ink text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setParsedReviewList((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="text-muted hover:text-rose"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveParsedChapters(sub.id)}
                              className="w-full py-2 rounded-input bg-cta-gradient text-white text-xs font-semibold shadow-cta"
                            >
                              Import Chapters
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chapters List */}
                    {subChapters.length === 0 ? (
                      <p className="text-xs text-muted-dim py-3 text-center">
                        No chapters yet — add your first one above.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {subChapters.map((ch, idx) => (
                          <div
                            key={ch.id}
                            className="p-3 rounded-input bg-surface-2 border border-border flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleChapter(ch)}
                                aria-label={`Mark chapter ${ch.title} ${ch.is_done ? 'incomplete' : 'complete'}`}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors pressable ${
                                  ch.is_done
                                    ? 'bg-mint text-bg border-mint'
                                    : 'bg-surface text-transparent border-border hover:border-primary'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                              <span className="text-xs font-bold text-muted-dim">{idx + 1}.</span>
                              <span
                                className={`text-sm font-medium text-ink truncate ${
                                  ch.is_done ? 'line-through text-muted' : ''
                                }`}
                              >
                                {ch.title}
                              </span>
                            </div>
                            <span className="text-xs text-muted flex-shrink-0">
                              {ch.est_min} mins
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
