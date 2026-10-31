import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowRight, ArrowLeft, Sparkles, FileText, Upload, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { generateSchedule, formatDate } from '../lib/scheduler';
import { parsePdfSyllabus } from '../lib/pdfParser';
import { SubjectBadge } from '../components/SubjectBadge';
import { Seo } from '../components/Seo';
import type { Block } from '../types/database';

interface SubjectDraft {
  tempId: string;
  name: string;
  exam_date: string | null;
  priority: number; // 1 = High, 2 = Medium, 3 = Low
  color_key: '1' | '2' | '3' | '4' | '5' | '6';
}

interface ChapterDraft {
  tempId: string;
  subjectTempId: string;
  title: string;
  est_min: number;
  position: number;
}

const PROGRAM_SUGGESTIONS: Record<string, string[]> = {
  Engineering: ['Mathematics I', 'Physics', 'Data Structures', 'Digital Electronics', 'Programming Fundamentals'],
  Medical: ['Anatomy', 'Physiology', 'Biochemistry', 'Pharmacology'],
  Science: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  Commerce: ['Accountancy', 'Business Studies', 'Economics', 'Statistics'],
  Arts: ['History', 'Political Science', 'Sociology', 'English'],
  Management: ['Marketing', 'Finance', 'Operations', 'Business Law'],
  Law: ['Constitutional Law', 'Contracts', 'Criminal Law'],
  Other: ['Chemistry', 'Mathematics', 'Physics'],
};

const COLOR_KEYS: Array<'1' | '2' | '3' | '4' | '5' | '6'> = ['1', '2', '3', '4', '5', '6'];

export const SetupPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Step 1: College & Program (Change 4)
  const [college, setCollege] = useState('');
  const [program, setProgram] = useState('Engineering');

  // Step 1: Pre-added 3 subjects with null exam date, priority = 2 (Medium) (Change 3)
  const [subjects, setSubjects] = useState<SubjectDraft[]>([
    { tempId: 'sub-chem', name: 'Chemistry', exam_date: null, priority: 2, color_key: '1' },
    { tempId: 'sub-math', name: 'Mathematics', exam_date: null, priority: 2, color_key: '2' },
    { tempId: 'sub-phys', name: 'Physics', exam_date: null, priority: 2, color_key: '3' },
  ]);

  const [newSubName, setNewSubName] = useState('');
  const [newSubExamDate, setNewSubExamDate] = useState('');

  // Step 2: Zero auto-seeded chapters initially (Change 1)
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('sub-chem');

  // Manual Chapter Entry: Method 1 (Single)
  const [singleTitle, setSingleTitle] = useState('');
  const [singleEstMin, setSingleEstMin] = useState(60);

  // Manual Chapter Entry: Method 2 & 3 (Paste / Upload Review)
  const [chapterEntryMode, setChapterEntryMode] = useState<'single' | 'paste' | 'upload'>('single');
  const [pasteText, setPasteText] = useState('');
  const [parsedReviewList, setParsedReviewList] = useState<Array<{ title: string; est_min: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Realistic Study Habits
  const [dailyHours, setDailyHours] = useState(2);
  const [sessionMin, setSessionMin] = useState(45);
  const [breakMin] = useState(10);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Add Subject
  const handleAddSubject = (nameToAdd?: string) => {
    const name = (nameToAdd || newSubName).trim();
    if (!name) return;

    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setErrorMsg(`"${name}" is already in your subjects.`);
      return;
    }

    const nextColorKey = COLOR_KEYS[subjects.length % COLOR_KEYS.length];
    const draft: SubjectDraft = {
      tempId: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      exam_date: newSubExamDate ? newSubExamDate : null,
      priority: 2,
      color_key: nextColorKey,
    };

    setSubjects([...subjects, draft]);
    setNewSubName('');
    setNewSubExamDate('');
    setErrorMsg(null);
  };

  const handleRemoveSubject = (tempId: string) => {
    if (subjects.length <= 1) {
      setErrorMsg('Please keep at least one subject.');
      return;
    }
    const filteredSubs = subjects.filter((s) => s.tempId !== tempId);
    setSubjects(filteredSubs);
    setChapters(chapters.filter((c) => c.subjectTempId !== tempId));
    if (activeSubjectTab === tempId && filteredSubs.length > 0) {
      setActiveSubjectTab(filteredSubs[0].tempId);
    }
  };

  // Chapter Entry: Method 1 (Single chapter)
  const handleAddSingleChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleTitle.trim()) return;

    const targetSub = subjects.find((s) => s.tempId === activeSubjectTab);
    const existingForSub = chapters.filter((c) => c.subjectTempId === activeSubjectTab);

    const draft: ChapterDraft = {
      tempId: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectTempId: activeSubjectTab,
      title: singleTitle.trim(),
      est_min: singleEstMin,
      position: existingForSub.length + 1,
    };

    setChapters([...chapters, draft]);
    setSingleTitle('');
    showToast(`Added chapter to ${targetSub?.name || 'subject'}.`);
  };

  // Parse lines for Paste & Upload (Split on newlines, trim, drop empties and duplicates, cap at 60)
  const parseLinesToChapters = (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((l) => l.length > 0);

    const uniqueLines = Array.from(new Set(lines)).slice(0, 60);
    return uniqueLines.map((title) => ({ title, est_min: 60 }));
  };

  // Chapter Entry: Method 2 (Paste submit)
  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    const items = parseLinesToChapters(pasteText);
    if (items.length === 0) {
      setErrorMsg('No valid chapter titles found in pasted text.');
      return;
    }
    setParsedReviewList(items);
    setErrorMsg(null);
  };

  // Chapter Entry: Method 3 (Upload file)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg(null);
      parsePdfSyllabus(file)
        .then((result) => {
          if (result.subjects.length > 0 && result.subjects[0].chapters.length > 0) {
            const chs = result.subjects[0].chapters.map((c) => ({
              title: c.title,
              est_min: c.est_min || 60,
            }));
            setParsedReviewList(chs);
            showToast(`Extracted ${chs.length} chapters from PDF syllabus!`);
          } else {
            setErrorMsg('No structured chapters found in PDF. Try pasting text.');
          }
        })
        .catch((err) => {
          setErrorMsg('Failed to parse PDF: ' + err.message);
        });
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

  // Confirm and Save parsed review list
  const handleSaveParsedChapters = () => {
    if (parsedReviewList.length === 0) return;
    const targetSub = subjects.find((s) => s.tempId === activeSubjectTab);
    const existingForSub = chapters.filter((c) => c.subjectTempId === activeSubjectTab);

    const newDrafts: ChapterDraft[] = parsedReviewList.map((item, idx) => ({
      tempId: `ch-${Date.now()}-${idx}`,
      subjectTempId: activeSubjectTab,
      title: item.title,
      est_min: item.est_min || 60,
      position: existingForSub.length + idx + 1,
    }));

    setChapters([...chapters, ...newDrafts]);
    setParsedReviewList([]);
    setPasteText('');
    setChapterEntryMode('single');
    showToast(`Added ${newDrafts.length} chapters to ${targetSub?.name || 'subject'}.`);
  };

  // Plan Generation
  const handleGeneratePlan = async () => {
    if (!user) return;
    setErrorMsg(null);
    setGenerating(true);

    try {
      // 1. Update Profile with college & program
      await dataService.upsertProfile({
        id: user.id,
        college: college.trim(),
        program,
        daily_hours: dailyHours,
        session_min: sessionMin,
        break_min: breakMin,
      });

      // 2. Save Subjects
      const subjectsToCreate = subjects.map((s) => ({
        user_id: user.id,
        name: s.name,
        color_key: s.color_key,
        exam_date: s.exam_date || null,
        priority: s.priority,
        is_archived: false,
      }));
      const createdSubjects = await dataService.createSubjects(subjectsToCreate);

      // Create mapping from tempId to created subject id
      const subjectIdMap = new Map<string, string>();
      subjects.forEach((s, idx) => {
        const found = createdSubjects[idx] || createdSubjects.find((cs) => cs.name === s.name);
        if (found) {
          subjectIdMap.set(s.tempId, found.id);
        }
      });

      // 3. Save Chapters
      const chaptersToCreate = chapters.map((c, idx) => ({
        user_id: user.id,
        subject_id: subjectIdMap.get(c.subjectTempId) || createdSubjects[0]?.id || '',
        title: c.title,
        est_min: c.est_min,
        is_done: false,
        position: idx + 1,
      }));
      const createdChapters = await dataService.createChapters(chaptersToCreate);

      await refreshProfile();

      // 4. Generate Schedule if chapters exist
      if (createdChapters.length > 0) {
        const todayStr = formatDate(new Date());
        const schedulerResult = generateSchedule({
          subjects: createdSubjects,
          chapters: createdChapters,
          config: {
            daily_hours: dailyHours,
            session_min: sessionMin,
            break_min: breakMin,
            start_date: todayStr,
          },
        });

        const blocksToCreate: Omit<Block, 'id' | 'created_at'>[] = schedulerResult.blocks.map((b) => ({
          user_id: user.id,
          chapter_id: b.chapter_id,
          date: b.date,
          start_min: b.start_min,
          duration_min: b.duration_min,
          status: 'scheduled',
        }));

        await dataService.createBlocks(blocksToCreate);
      }

      navigate('/app', { replace: true });
    } catch (err: any) {
      console.error('Plan generation failed:', err);
      setErrorMsg(err.message || 'Failed to generate plan. Please try again.');
      setGenerating(false);
    }
  };

  const activeSubject = subjects.find((s) => s.tempId === activeSubjectTab);
  const activeSubjectChapters = chapters.filter((c) => c.subjectTempId === activeSubjectTab);
  const suggestedForProgram = PROGRAM_SUGGESTIONS[program] || PROGRAM_SUGGESTIONS.Other;

  return (
    <div className="min-h-screen bg-bg text-ink py-10 px-4 sm:px-6">
      <Seo
        title="Set Up Your Plan in 3 Minutes"
        description="Configure your college, subjects, chapters, and daily study habits to build your roadmap."
        noIndex={true}
        canonicalPath="/setup"
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step Indicator Header */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Onboarding</p>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink mt-1">
            Set it up in 3 minutes
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Step {step} of 3: {step === 1 ? 'College & Subjects' : step === 2 ? 'Chapters & Syllabus' : 'Daily Study Habits'}
          </p>

          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-10 bg-primary'
                    : s < step
                    ? 'w-6 bg-mint'
                    : 'w-6 bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Global Toast */}
        {toastMsg && (
          <div className="p-3.5 rounded-input bg-mint-soft border border-mint/30 text-mint text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-input bg-rose/10 border border-rose/30 text-rose text-xs font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================
            STEP 1: COLLEGE, PROGRAM & SUBJECTS
            ======================================================== */}
        {step === 1 && (
          <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-ink">1 · College & Subjects</h2>
              <p className="text-xs text-muted mt-0.5">
                Tell us your college and select your subjects. Set exam dates when ready.
              </p>
            </div>

            {/* College Name & Program (Change 4) */}
            <div className="space-y-4 pb-4 border-b border-border">
              <div>
                <label htmlFor="college-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  College Name <span className="text-rose">*</span>
                </label>
                <input
                  id="college-input"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. Stanford University or MIT"
                  className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-base focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="program-select" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Degree / Program
                </label>
                <select
                  id="program-select"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-base focus:border-primary transition-colors"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Medical">Medical</option>
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts</option>
                  <option value="Management">Management</option>
                  <option value="Law">Law</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Current Subjects List (Chemistry, Math, Physics pre-added) */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                Your Subjects ({subjects.length})
              </label>

              <div className="space-y-2.5">
                {subjects.map((sub) => (
                  <div
                    key={sub.tempId}
                    className="p-3 rounded-input bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SubjectBadge name={sub.name} colorKey={sub.color_key} size="sm" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                      {/* Optional Exam Date */}
                      <input
                        type="date"
                        aria-label={`Exam date for ${sub.name}`}
                        value={sub.exam_date || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setSubjects((prev) =>
                            prev.map((s) => (s.tempId === sub.tempId ? { ...s, exam_date: val } : s))
                          );
                        }}
                        className="px-2.5 py-1 rounded-input border border-border bg-surface text-ink text-xs focus:border-primary"
                      />

                      {/* 3-way Priority Segmented Control (Low=3, Med=2, High=1) */}
                      <div className="inline-flex rounded-input border border-border bg-surface p-0.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setSubjects((prev) =>
                              prev.map((s) => (s.tempId === sub.tempId ? { ...s, priority: 3 } : s))
                            );
                          }}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            sub.priority === 3 ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink'
                          }`}
                        >
                          Low
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubjects((prev) =>
                              prev.map((s) => (s.tempId === sub.tempId ? { ...s, priority: 2 } : s))
                            );
                          }}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            sub.priority === 2 ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink'
                          }`}
                        >
                          Med
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubjects((prev) =>
                              prev.map((s) => (s.tempId === sub.tempId ? { ...s, priority: 1 } : s))
                            );
                          }}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            sub.priority === 1 ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink'
                          }`}
                        >
                          High
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(sub.tempId)}
                        aria-label={`Remove subject ${sub.name}`}
                        className="w-8 h-8 flex items-center justify-center rounded-input text-muted hover:text-rose hover:bg-rose/10 transition-colors pressable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested for You Chip Row (Change 4) */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Suggested for {program}:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestedForProgram.map((sugName) => {
                  const alreadyAdded = subjects.some(
                    (s) => s.name.toLowerCase() === sugName.toLowerCase()
                  );

                  return (
                    <button
                      key={sugName}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleAddSubject(sugName)}
                      className={`text-xs px-3 py-1.5 rounded-pill border font-medium transition-all flex items-center gap-1.5 pressable ${
                        alreadyAdded
                          ? 'bg-surface-2 text-muted-dim border-border cursor-not-allowed opacity-60'
                          : 'bg-primary-soft text-primary border-primary/30 hover:bg-primary-soft/80'
                      }`}
                    >
                      {alreadyAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{sugName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Custom Subject Form */}
            <div className="pt-4 border-t border-border space-y-3">
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                Add Another Subject
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence"
                  className="flex-1 px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-base focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleAddSubject()}
                  className="px-5 py-2.5 rounded-input bg-surface-2 border border-border hover:border-primary text-primary font-semibold text-xs flex items-center gap-1.5 pressable min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (college.trim().length < 2) {
                    setErrorMsg('Please enter your college name (minimum 2 characters).');
                    return;
                  }
                  if (subjects.length === 0) {
                    setErrorMsg('Please keep at least one subject.');
                    return;
                  }
                  setErrorMsg(null);
                  setActiveSubjectTab(subjects[0].tempId);
                  setStep(2);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-input bg-cta-gradient text-white font-semibold text-sm shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center gap-2 pressable"
              >
                <span>Continue to Chapters</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2: CHAPTERS (MANUAL SYLLABUS ENTRY - Change 2)
            Zero chapters initially + 3 entry methods
            ======================================================== */}
        {step === 2 && (
          <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-ink">2 · Enter your syllabus</h2>
              <p className="text-xs text-muted mt-0.5">
                Add chapters for each subject. You can add one by one, paste a list, or upload a file.
              </p>
            </div>

            {/* Subject Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {subjects.map((sub) => {
                const isActive = activeSubjectTab === sub.tempId;
                const chapterCount = chapters.filter((c) => c.subjectTempId === sub.tempId).length;
                return (
                  <button
                    key={sub.tempId}
                    type="button"
                    onClick={() => {
                      setActiveSubjectTab(sub.tempId);
                      setParsedReviewList([]);
                    }}
                    className={`px-3.5 py-2 rounded-pill text-xs font-semibold flex items-center gap-2 whitespace-nowrap min-h-[44px] border transition-all pressable ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-2 text-muted border-border hover:text-ink'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-surface border border-border text-ink'}`}>
                      {chapterCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Subject Chapters List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Chapters in {activeSubject?.name || 'Subject'} ({activeSubjectChapters.length})
                </span>
              </div>

              {activeSubjectChapters.length === 0 ? (
                // Empty state as specified in Change 1
                <div className="py-8 px-4 rounded-input bg-surface-2/40 border border-border/80 text-center">
                  <p className="text-xs sm:text-sm text-muted">
                    No chapters yet — add your first one below.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {activeSubjectChapters.map((ch, idx) => (
                    <div
                      key={ch.tempId}
                      className="p-3 rounded-input bg-surface-2 border border-border flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-muted-dim">{idx + 1}.</span>
                        <span className="text-sm font-medium text-ink truncate">{ch.title}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted font-medium">{ch.est_min}m</span>
                        <button
                          type="button"
                          onClick={() => setChapters(chapters.filter((c) => c.tempId !== ch.tempId))}
                          aria-label={`Remove chapter ${ch.title}`}
                          className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-rose hover:bg-rose/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* THREE WAYS TO ADD CHAPTERS (Change 2) */}
            <div className="pt-4 border-t border-border space-y-4">
              {/* Method Switcher Tabs */}
              <div className="flex border-b border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setChapterEntryMode('single'); setParsedReviewList([]); }}
                  className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    chapterEntryMode === 'single' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>One at a time</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setChapterEntryMode('paste'); setParsedReviewList([]); }}
                  className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    chapterEntryMode === 'paste' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste a syllabus</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setChapterEntryMode('upload'); setParsedReviewList([]); }}
                  className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    chapterEntryMode === 'upload' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload file (.txt, .csv)</span>
                </button>
              </div>

              {/* METHOD 1: ONE AT A TIME */}
              {chapterEntryMode === 'single' && (
                <form onSubmit={handleAddSingleChapter} className="space-y-3">
                  <div>
                    <label htmlFor="ch-title" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                      Chapter Title
                    </label>
                    <input
                      id="ch-title"
                      type="text"
                      required
                      value={singleTitle}
                      onChange={(e) => setSingleTitle(e.target.value)}
                      placeholder="e.g. Thermodynamics or Differential Calculus"
                      className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-base focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                      Time Estimate Chips
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '30m', val: 30 },
                        { label: '1h', val: 60 },
                        { label: '1.5h', val: 90 },
                        { label: '2h', val: 120 },
                      ].map((chip) => (
                        <button
                          key={chip.val}
                          type="button"
                          onClick={() => setSingleEstMin(chip.val)}
                          className={`py-2 px-1 rounded-input text-xs sm:text-sm font-semibold border transition-all min-h-[44px] flex items-center justify-center pressable ${
                            singleEstMin === chip.val
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-surface-2 text-muted border-border hover:border-primary/40'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-input bg-primary-soft text-primary font-semibold text-sm hover:bg-primary-soft/80 border border-primary/20 transition-colors min-h-[44px] flex items-center justify-center gap-1.5 pressable"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to {activeSubject?.name}</span>
                  </button>
                </form>
              )}

              {/* METHOD 2: PASTE A SYLLABUS */}
              {chapterEntryMode === 'paste' && parsedReviewList.length === 0 && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="paste-textarea" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                      Paste Syllabus Text
                    </label>
                    <textarea
                      id="paste-textarea"
                      rows={5}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`1. Mechanics\n2. Oscillations & Waves\n3. Heat and Thermodynamics\n4. Electrostatics`}
                      className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-sm focus:border-primary transition-colors font-mono"
                    />
                    <p className="text-xs text-muted mt-1">
                      Paste your syllabus — one chapter per line.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleParsePaste}
                    className="w-full py-2.5 rounded-input bg-primary text-white font-semibold text-sm hover:bg-primary-hi transition-colors min-h-[44px] flex items-center justify-center gap-1.5 pressable shadow-cta"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Review Chapters</span>
                  </button>
                </div>
              )}

              {/* METHOD 3: UPLOAD FILE (.txt, .csv) */}
              {chapterEntryMode === 'upload' && parsedReviewList.length === 0 && (
                <div className="space-y-3">
                  <div className="p-6 rounded-card border-2 border-dashed border-border text-center bg-surface-2/40">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold text-ink">Upload syllabus file</p>
                    <p className="text-xs text-muted mt-0.5">Supports .txt or .csv files (one topic per line)</p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="syllabus-file-upload"
                    />
                    <label
                      htmlFor="syllabus-file-upload"
                      className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-input bg-primary text-white font-semibold text-xs cursor-pointer hover:bg-primary-hi transition-colors pressable"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose File</span>
                    </label>
                  </div>
                </div>
              )}

              {/* EDITABLE REVIEW LIST (After paste or upload) */}
              {parsedReviewList.length > 0 && (
                <div className="space-y-3 p-4 rounded-card bg-surface-2 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-ink">
                        Review Parsed Chapters ({parsedReviewList.length})
                      </h4>
                      <p className="text-[11px] text-muted">Adjust titles or time before importing</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParsedReviewList([])}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {parsedReviewList.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-muted-dim font-bold w-5">{idx + 1}.</span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParsedReviewList((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, title: val } : it))
                            );
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-input border border-border bg-surface text-ink text-xs focus:border-primary"
                        />
                        <select
                          value={item.est_min}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setParsedReviewList((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, est_min: val } : it))
                            );
                          }}
                          className="px-2 py-1.5 rounded-input border border-border bg-surface text-ink text-xs"
                        >
                          <option value={30}>30m</option>
                          <option value={45}>45m</option>
                          <option value={60}>1h</option>
                          <option value={90}>1.5h</option>
                          <option value={120}>2h</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setParsedReviewList((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="w-7 h-7 flex items-center justify-center text-muted hover:text-rose"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveParsedChapters}
                    className="w-full py-2.5 rounded-input bg-cta-gradient text-white font-semibold text-xs flex items-center justify-center gap-2 pressable shadow-cta"
                  >
                    <Check className="w-4 h-4" />
                    <span>Import {parsedReviewList.length} Chapters into {activeSubject?.name}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-input border border-border bg-surface text-ink text-sm font-medium hover:bg-surface-2 transition-colors min-h-[44px] flex items-center gap-2 pressable"
              >
                <ArrowLeft className="w-4 h-4 text-muted" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (chapters.length === 0) {
                    setErrorMsg('Please add at least one chapter to continue.');
                    return;
                  }
                  setErrorMsg(null);
                  setStep(3);
                }}
                className="px-6 py-3 rounded-input bg-cta-gradient text-white font-semibold text-sm shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center gap-2 pressable"
              >
                <span>Continue to Study Hours</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: STUDY HABITS & SCHEDULE GENERATION
            ======================================================== */}
        {step === 3 && (
          <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-6">
            <div>
              <h2 className="font-heading font-bold text-lg text-ink">3 · Realistic study habits</h2>
              <p className="text-xs text-muted mt-0.5">
                How many hours a day you can realistically study, plus your session length.
              </p>
            </div>

            {/* Daily Hours */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink uppercase tracking-wider">
                  Realistic Daily Study Cap
                </label>
                <span className="font-heading font-bold text-lg text-primary">{dailyHours} hours/day</span>
              </div>
              <p className="text-xs text-muted">
                Be honest. Planora enforces this strictly to prevent burnout and collapse.
              </p>
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[1.5, 2, 3, 4].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDailyHours(hrs)}
                    className={`py-2 rounded-input text-sm font-semibold border transition-all min-h-[44px] flex items-center justify-center pressable ${
                      dailyHours === hrs
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-2 text-muted border-border hover:border-primary/40'
                    }`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>

            {/* Session Length */}
            <div className="space-y-2 pt-4 border-t border-border">
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                Session Length (with 10m break after each)
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[30, 45, 60].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setSessionMin(len)}
                    className={`py-2 rounded-input text-sm font-semibold border transition-all min-h-[44px] flex items-center justify-center pressable ${
                      sessionMin === len
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-2 text-muted border-border hover:border-primary/40'
                    }`}
                  >
                    {len} mins
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={generating}
                className="px-5 py-2.5 rounded-input border border-border bg-surface text-ink text-sm font-medium hover:bg-surface-2 transition-colors min-h-[44px] flex items-center gap-2 pressable"
              >
                <ArrowLeft className="w-4 h-4 text-muted" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={generating}
                className="w-full sm:w-auto px-7 py-3.5 rounded-input bg-cta-gradient text-white font-semibold text-base shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center gap-2 pressable disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Calculating Deterministic Schedule...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate My Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
