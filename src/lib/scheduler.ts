import type { Subject, Chapter, Block } from '../types/database';

export interface SchedulerConfig {
  daily_hours: number;
  session_min?: number; // default 45
  break_min?: number;   // default 10
  start_date: string;   // YYYY-MM-DD
  start_time_min?: number; // minutes from midnight, default 540 (09:00)
}

export interface DeficitReport {
  subject_id: string;
  subject_name: string;
  exam_date: string | null;
  deficit_min: number;
  message: string;
}

export interface ScheduledBlockItem {
  id?: string;
  chapter_id: string;
  subject_id: string;
  subject_name: string;
  chapter_title: string;
  color_key: '1' | '2' | '3' | '4' | '5' | '6';
  date: string; // YYYY-MM-DD
  start_min: number;
  duration_min: number;
  status: 'scheduled' | 'done' | 'missed';
}

export interface SchedulerOutput {
  blocks: ScheduledBlockItem[];
  deficits: DeficitReport[];
}

export function parseDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

export function diffDays(targetDate: string, fromDate: string): number {
  const a = parseDate(targetDate);
  const b = parseDate(fromDate);
  const diffTime = a.getTime() - b.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDeficitMessage(subjectName: string, minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m won't fit before your ${subjectName} exam.`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h won't fit before your ${subjectName} exam.`;
  }
  return `${hours}h ${mins}m won't fit before your ${subjectName} exam.`;
}

export function calculateScore(
  subject: Subject,
  _chapter: Chapter,
  currentDateStr: string,
  isMissed: boolean
): number {
  // score = 0.60 * deadlinePressure
  //       + 0.25 * priorityScore          // 1→1.00 (High), 2→0.67 (Med), 3→0.33 (Low)
  //       + 0.15 * overdueFlag            // 1 if the chapter had a missed block

  let deadlinePressure = 0;
  if (subject.exam_date) {
    const daysLeft = diffDays(subject.exam_date, currentDateStr);
    if (daysLeft <= 1) {
      deadlinePressure = 1.0;
    } else {
      deadlinePressure = Math.max(0, 1 - (daysLeft - 1) / 30);
    }
  }

  let priorityScore = 0.67;
  if (subject.priority === 1) priorityScore = 1.0;
  else if (subject.priority === 2) priorityScore = 0.67;
  else if (subject.priority === 3) priorityScore = 0.33;

  const overdueFlag = isMissed ? 1.0 : 0.0;

  return 0.60 * deadlinePressure + 0.25 * priorityScore + 0.15 * overdueFlag;
}

interface PendingWorkBlock {
  chapter_id: string;
  subject_id: string;
  subject_name: string;
  chapter_title: string;
  color_key: '1' | '2' | '3' | '4' | '5' | '6';
  duration_min: number;
  score: number;
  position: number;
  total_chapter_blocks: number;
  exam_date: string | null;
}

export function generateSchedule(params: {
  subjects: Subject[];
  chapters: Chapter[];
  config: SchedulerConfig;
  existing_blocks?: Block[];
  missed_chapter_ids?: Set<string>;
}): SchedulerOutput {
  const {
    subjects,
    chapters,
    config,
    existing_blocks = [],
    missed_chapter_ids = new Set(),
  } = params;

  const sessionMin = config.session_min || 45;
  const breakMin = config.break_min !== undefined ? config.break_min : 10;
  const dailyCapMin = Math.round(config.daily_hours * 60);
  const startTimeMin = config.start_time_min ?? 540; // 09:00 default
  const startDate = config.start_date;

  const subjectMap = new Map<string, Subject>();
  subjects.forEach((s) => subjectMap.set(s.id, s));

  // Calculate already completed minutes per chapter
  const doneMinutesPerChapter = new Map<string, number>();
  existing_blocks.forEach((b) => {
    if (b.status === 'done') {
      const cur = doneMinutesPerChapter.get(b.chapter_id) || 0;
      doneMinutesPerChapter.set(b.chapter_id, cur + b.duration_min);
    }
  });

  // Build the list of needed blocks for each active chapter
  const pendingBlocks: PendingWorkBlock[] = [];

  for (const chapter of chapters) {
    if (chapter.is_done) continue;
    const subject = subjectMap.get(chapter.subject_id);
    if (!subject) continue;

    const doneMin = doneMinutesPerChapter.get(chapter.id) || 0;
    const remainingMin = Math.max(0, chapter.est_min - doneMin);
    if (remainingMin <= 0) continue;

    // Split chapter into blocks of session_min
    let rem = remainingMin;
    const blockDurations: number[] = [];
    while (rem > 0) {
      const dur = rem >= sessionMin ? sessionMin : rem;
      blockDurations.push(dur);
      rem -= dur;
    }

    const isMissed = missed_chapter_ids.has(chapter.id);
    const score = calculateScore(subject, chapter, startDate, isMissed);

    blockDurations.forEach((dur) => {
      pendingBlocks.push({
        chapter_id: chapter.id,
        subject_id: chapter.subject_id,
        subject_name: subject.name,
        chapter_title: chapter.title,
        color_key: subject.color_key,
        duration_min: dur,
        score,
        position: chapter.position,
        total_chapter_blocks: blockDurations.length,
        exam_date: subject.exam_date || null,
      });
    });
  }

  // Find max horizon
  let latestExamDate = startDate;
  for (const s of subjects) {
    if (s.exam_date && s.exam_date > latestExamDate) {
      latestExamDate = s.exam_date;
    }
  }
  const maxDays = Math.max(30, diffDays(latestExamDate, startDate) + 1);

  const scheduledBlocks: ScheduledBlockItem[] = [];
  const assignedBlockIndices = new Set<number>();

  // Iterate day by day starting from startDate
  for (let dayOffset = 0; dayOffset <= maxDays; dayOffset++) {
    if (assignedBlockIndices.size === pendingBlocks.length) {
      break;
    }

    const currentDate = addDays(startDate, dayOffset);
    let dayStudyMin = 0;
    let dayCurrentTime = startTimeMin;
    const daySubjectHistory: string[] = [];
    const dayChapterBlockCount = new Map<string, number>();

    while (true) {
      let bestIndex = -1;
      let bestScore = -1;

      for (let i = 0; i < pendingBlocks.length; i++) {
        if (assignedBlockIndices.has(i)) continue;
        const cand = pendingBlocks[i];

        // Constraint: stop scheduling a subject the day before its exam
        if (cand.exam_date) {
          const daysToExam = diffDays(cand.exam_date, currentDate);
          if (daysToExam < 1) {
            continue;
          }
        }

        // Constraint: never exceed declared daily hours
        if (dayStudyMin + cand.duration_min > dailyCapMin) {
          continue;
        }

        // Constraint: spread a long chapter across days instead of one marathon
        const chapterBlocksOnDay = dayChapterBlockCount.get(cand.chapter_id) || 0;
        const daysToExam = cand.exam_date ? diffDays(cand.exam_date, currentDate) : 10;
        if (cand.total_chapter_blocks > 1 && daysToExam > 1) {
          if (chapterBlocksOnDay >= 1) {
            continue;
          }
        }

        // Constraint: never three consecutive blocks of the same subject
        const len = daySubjectHistory.length;
        if (
          len >= 2 &&
          daySubjectHistory[len - 1] === cand.subject_id &&
          daySubjectHistory[len - 2] === cand.subject_id
        ) {
          continue;
        }

        // Rank by dynamic score as of currentDate
        const dynScore = calculateScore(
          subjectMap.get(cand.subject_id)!,
          { id: cand.chapter_id } as Chapter,
          currentDate,
          missed_chapter_ids.has(cand.chapter_id)
        );

        if (dynScore > bestScore) {
          bestScore = dynScore;
          bestIndex = i;
        } else if (dynScore === bestScore && bestIndex !== -1) {
          if (cand.position < pendingBlocks[bestIndex].position) {
            bestIndex = i;
          } else if (
            cand.position === pendingBlocks[bestIndex].position &&
            cand.chapter_id < pendingBlocks[bestIndex].chapter_id
          ) {
            bestIndex = i;
          }
        }
      }

      if (bestIndex === -1) {
        break;
      }

      const chosen = pendingBlocks[bestIndex];
      assignedBlockIndices.add(bestIndex);

      scheduledBlocks.push({
        chapter_id: chosen.chapter_id,
        subject_id: chosen.subject_id,
        subject_name: chosen.subject_name,
        chapter_title: chosen.chapter_title,
        color_key: chosen.color_key,
        date: currentDate,
        start_min: dayCurrentTime,
        duration_min: chosen.duration_min,
        status: 'scheduled',
      });

      dayStudyMin += chosen.duration_min;
      dayCurrentTime += chosen.duration_min + breakMin;
      daySubjectHistory.push(chosen.subject_id);
      dayChapterBlockCount.set(chosen.chapter_id, (dayChapterBlockCount.get(chosen.chapter_id) || 0) + 1);
    }
  }

  // Calculate deficits for any pending blocks with exam_date that could not fit before exam
  const deficitsBySubject = new Map<string, number>();
  for (let i = 0; i < pendingBlocks.length; i++) {
    if (!assignedBlockIndices.has(i)) {
      const b = pendingBlocks[i];
      if (b.exam_date) {
        const cur = deficitsBySubject.get(b.subject_id) || 0;
        deficitsBySubject.set(b.subject_id, cur + b.duration_min);
      }
    }
  }

  const deficits: DeficitReport[] = [];
  deficitsBySubject.forEach((deficitMin, subId) => {
    const sub = subjectMap.get(subId);
    if (sub && deficitMin > 0) {
      deficits.push({
        subject_id: subId,
        subject_name: sub.name,
        exam_date: sub.exam_date,
        deficit_min: deficitMin,
        message: formatDeficitMessage(sub.name, deficitMin),
      });
    }
  });

  return {
    blocks: scheduledBlocks,
    deficits,
  };
}
