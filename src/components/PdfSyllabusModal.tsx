import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Calendar,
  BookOpen,
  CheckCircle,
  Trash2,
  Plus,
  Loader2,
  History,
} from 'lucide-react';
import {
  parsePdfSyllabus,
  type ParsedSyllabusResult,
  type ExtractedAcademicEvent,
  type ExtractedChapter,
} from '../lib/pdfParser';
import { dataService } from '../lib/dataService';
import type { Subject, ImportBatch } from '../types/database';

interface PdfSyllabusModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (subjectId: string) => void;
  existingSubjects?: Subject[];
}

export const PdfSyllabusModal: React.FC<PdfSyllabusModalProps> = ({
  userId,
  isOpen,
  onClose,
  onImportComplete,
  existingSubjects = [],
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSyllabusResult | null>(null);

  // Editable review states
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [chapters, setChapters] = useState<ExtractedChapter[]>([]);
  const [events, setEvents] = useState<ExtractedAcademicEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'syllabus' | 'events' | 'history'>('syllabus');

  // Import history
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parsePdfSyllabus(selectedFile);
      setParsedData(result);

      if (result.subjects.length > 0) {
        setSubjectName(result.subjects[0].name);
        setSubjectCode(result.subjects[0].code || '');
        setChapters(result.subjects[0].chapters);
      }
      setEvents(result.events);
    } catch (err: any) {
      console.error('PDF Parsing failed:', err);
      setParseError(err.message || 'Could not parse PDF. Please ensure it contains readable text.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
        handleFileChange(droppedFile);
      } else {
        setParseError('Please upload a PDF document.');
      }
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const batches = await dataService.getImportBatches(userId);
      setImportHistory(batches);
    } catch (e) {
      console.warn('Failed to load import history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveImport = async () => {
    if (!subjectName.trim()) {
      setParseError('Please specify a subject name.');
      return;
    }
    if (chapters.length === 0) {
      setParseError('Please include at least one chapter or topic.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create or link Subject
      const assignedColor = (['1', '2', '3', '4', '5', '6'][
        existingSubjects.length % 6
      ] as '1' | '2' | '3' | '4' | '5' | '6');

      const examDate = events.find((e) => e.event_type === 'exam')?.start_date || null;

      const [createdSub] = await dataService.createSubjects([
        {
          user_id: userId,
          name: subjectName.trim(),
          code: subjectCode.trim() || null,
          color_key: assignedColor,
          exam_date: examDate,
          priority: 2,
          confidence: 2,
        },
      ]);

      const subId = createdSub.id;

      // 2. Create Chapters
      const newChapters = chapters.map((ch, idx) => ({
        user_id: userId,
        subject_id: subId,
        unit_title: ch.unit_title || null,
        title: ch.title,
        est_min: ch.est_min || 60,
        is_done: false,
        status: 'not_started' as const,
        position: idx + 1,
      }));

      await dataService.createChapters(newChapters);

      // 3. Create Academic Events
      if (events.length > 0) {
        const newEvents = events.map((ev) => ({
          user_id: userId,
          subject_id: subId,
          title: ev.title,
          event_type: ev.event_type,
          start_date: ev.start_date,
          end_date: ev.end_date || null,
          notes: `Extracted from page ${ev.source_page}: "${ev.source_snippet}"`,
        }));
        await dataService.createAcademicEvents(newEvents);
      }

      // 4. Record Import Batch
      await dataService.createImportBatch({
        user_id: userId,
        file_name: file?.name || 'Uploaded Syllabus.pdf',
        items_count: chapters.length,
        events_count: events.length,
        status: 'completed',
      });

      onImportComplete(subId);
      onClose();
    } catch (err: any) {
      console.error('Failed to save imported syllabus:', err);
      setParseError(err.message || 'Failed to save imported syllabus.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Smart PDF Syllabus Import</h2>
              <p className="text-xs text-muted">
                Extract subjects, unit breakdown, and exam/assignment dates client-side
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!parsedData && !isParsing && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-4 bg-surface-2/20 cursor-pointer"
              onClick={() => document.getElementById('pdf-file-input')?.click()}
            >
              <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Click or drag your course syllabus PDF here
                </p>
                <p className="text-xs text-muted mt-1">
                  Supports modern PDF syllabi with course schedules, units, and deadlines
                </p>
              </div>
              <input
                id="pdf-file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('history');
                    loadHistory();
                  }}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> View past imports
                </button>
              </div>
            </div>
          )}

          {isParsing && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-ink">Analyzing Syllabus Document...</h4>
                <p className="text-xs text-muted mt-1">
                  Extracting text, detecting subject names, chapters, and academic deadlines
                </p>
              </div>
            </div>
          )}

          {parseError && (
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-start justify-between">
              <span>{parseError}</span>
              <button onClick={() => setParseError(null)} className="text-xs underline font-semibold">
                Dismiss
              </button>
            </div>
          )}

          {/* Review & Provenance Screen */}
          {parsedData && (
            <div className="space-y-5">
              {/* Top controls: Subject & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-2/50 p-4 rounded-xl border border-border">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink focus:outline-none focus:border-primary"
                    placeholder="e.g. Organic Chemistry"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                    Course Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink focus:outline-none focus:border-primary"
                    placeholder="e.g. CHEM 201"
                  />
                </div>
              </div>

              {/* Tabs for Review */}
              <div className="flex items-center gap-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('syllabus')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'syllabus'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Syllabus & Chapters ({chapters.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className={`pb-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'events'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Exams & Academic Dates ({events.length})
                </button>
              </div>

              {/* Tab 1: Chapters Review */}
              {activeTab === 'syllabus' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Provenance snippets extracted from PDF pages. Edit or adjust times:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setChapters([
                          ...chapters,
                          {
                            id: `ch_new_${Date.now()}`,
                            unit_title: 'Unit 1',
                            title: 'New Chapter',
                            est_min: 60,
                            source_page: 1,
                            source_snippet: 'Manual entry',
                          },
                        ])
                      }
                      className="text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Chapter
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {chapters.map((ch, idx) => (
                      <div
                        key={ch.id}
                        className="p-3 bg-surface border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 text-muted">
                              {ch.unit_title || `Item ${idx + 1}`}
                            </span>
                            <span className="text-xs text-muted">Page {ch.source_page}</span>
                          </div>
                          <input
                            type="text"
                            value={ch.title}
                            onChange={(e) => {
                              const updated = [...chapters];
                              updated[idx].title = e.target.value;
                              setChapters(updated);
                            }}
                            className="w-full text-ink font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                          />
                          {ch.source_snippet && ch.source_snippet !== 'Manual entry' && (
                            <p className="text-[11px] text-muted italic line-clamp-1">
                              &ldquo;{ch.source_snippet}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Time estimate selector */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {[30, 45, 60, 90, 120].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                const updated = [...chapters];
                                updated[idx].est_min = mins;
                                setChapters(updated);
                              }}
                              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                                ch.est_min === mins
                                  ? 'bg-primary text-white'
                                  : 'bg-surface-2 text-muted hover:text-ink'
                              }`}
                            >
                              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setChapters(chapters.filter((_, i) => i !== idx))}
                            className="p-1.5 text-muted hover:text-danger rounded-lg transition-colors ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Events Review */}
              {activeTab === 'events' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Exams, assignments, and key dates detected:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEvents([
                          ...events,
                          {
                            id: `evt_new_${Date.now()}`,
                            title: 'New Exam / Test',
                            event_type: 'exam',
                            start_date: new Date().toISOString().split('T')[0],
                            source_page: 1,
                            source_snippet: 'Manual entry',
                          },
                        ])
                      }
                      className="text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Event
                    </button>
                  </div>

                  {events.length === 0 ? (
                    <div className="p-8 text-center text-muted text-sm bg-surface-2/20 rounded-xl">
                      No explicit exam dates found in PDF. You can set one manually using the button above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {events.map((ev, idx) => (
                        <div
                          key={ev.id}
                          className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  ev.event_type === 'exam'
                                    ? 'bg-danger/10 text-danger'
                                    : ev.event_type === 'assignment'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-primary-soft text-primary'
                                }`}
                              >
                                {ev.event_type}
                              </span>
                              <span className="text-xs text-muted">Page {ev.source_page}</span>
                            </div>
                            <input
                              type="text"
                              value={ev.title}
                              onChange={(e) => {
                                const updated = [...events];
                                updated[idx].title = e.target.value;
                                setEvents(updated);
                              }}
                              className="w-full text-ink font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                            />
                            {ev.source_snippet && ev.source_snippet !== 'Manual entry' && (
                              <p className="text-[11px] text-muted italic line-clamp-1">
                                &ldquo;{ev.source_snippet}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="date"
                              value={ev.start_date}
                              onChange={(e) => {
                                const updated = [...events];
                                updated[idx].start_date = e.target.value;
                                setEvents(updated);
                              }}
                              className="px-2 py-1 text-xs bg-surface-2 border border-border rounded-lg text-ink"
                            />
                            <button
                              type="button"
                              onClick={() => setEvents(events.filter((_, i) => i !== idx))}
                              className="p-1.5 text-muted hover:text-danger rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && !parsedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">Past Syllabus Imports</h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('syllabus')}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Back to upload
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </div>
              ) : importHistory.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">No previous imports recorded.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importHistory.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-ink">{batch.file_name}</p>
                        <p className="text-muted text-[11px]">
                          {new Date(batch.created_at).toLocaleDateString()} &bull; {batch.items_count} chapters,{' '}
                          {batch.events_count} events
                        </p>
                      </div>
                      <span className="text-mint font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Saved
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
            Cancel
          </button>

          {parsedData && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setParsedData(null);
                  setFile(null);
                }}
                className="px-4 py-2 text-sm text-muted hover:text-ink font-medium"
              >
                Re-upload
              </button>
              <button
                type="button"
                disabled={isSubmitting || chapters.length === 0}
                onClick={handleSaveImport}
                className="px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Import Syllabus ({chapters.length} chapters)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
