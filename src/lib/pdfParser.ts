import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using URL resolving in Vite
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ExtractedAcademicEvent {
  id: string;
  title: string;
  event_type: 'exam' | 'assignment' | 'class' | 'holiday';
  start_date: string;
  end_date?: string;
  source_page: number;
  source_snippet: string;
}

export interface ExtractedChapter {
  id: string;
  unit_title?: string;
  title: string;
  est_min: number;
  source_page: number;
  source_snippet: string;
}

export interface ExtractedSubject {
  id: string;
  name: string;
  code?: string;
  exam_date?: string;
  chapters: ExtractedChapter[];
}

export interface ParsedSyllabusResult {
  subjects: ExtractedSubject[];
  events: ExtractedAcademicEvent[];
  totalPages: number;
}

// Helper to normalize and parse dates found in text into YYYY-MM-DD
export function parseDateString(text: string, referenceYear = new Date().getFullYear()): string | null {
  // ISO format: YYYY-MM-DD
  const isoMatch = text.match(/\b(202[4-9])-([01]?\d)-([0-3]?\d)\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Month names
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  // e.g. "Nov 15, 2026" or "November 15" or "15 Nov 2026"
  const monthRegex = new RegExp(
    `\\b(${Object.keys(months).join('|')})\\.?\\s+([0-3]?\\d)(?:st|nd|rd|th)?(?:,?\\s+(202[4-9]))?\\b`,
    'i'
  );
  const match1 = text.match(monthRegex);
  if (match1) {
    const month = months[match1[1].toLowerCase()];
    const day = match1[2].padStart(2, '0');
    const year = match1[3] ? parseInt(match1[3], 10) : referenceYear;
    return `${year}-${month}-${day}`;
  }

  // e.g. "15 November 2026"
  const dayMonthRegex = new RegExp(
    `\\b([0-3]?\\d)(?:st|nd|rd|th)?\\s+(${Object.keys(months).join('|')})\\.?\\s*(202[4-9])?\\b`,
    'i'
  );
  const match2 = text.match(dayMonthRegex);
  if (match2) {
    const day = match2[1].padStart(2, '0');
    const month = months[match2[2].toLowerCase()];
    const year = match2[3] ? parseInt(match2[3], 10) : referenceYear;
    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY (assuming MM/DD/YYYY if ambiguous or valid)
  const slashMatch = text.match(/\b([01]?\d)[/-]([0-3]?\d)[/-](202[4-9])\b/);
  if (slashMatch) {
    const [, p1, p2, yr] = slashMatch;
    let m = parseInt(p1, 10);
    let d = parseInt(p2, 10);
    if (m > 12 && d <= 12) {
      // swapped DD/MM/YYYY
      [m, d] = [d, m];
    }
    return `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return null;
}

export async function parsePdfSyllabus(fileOrBuffer: File | ArrayBuffer): Promise<ParsedSyllabusResult> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  const pageTexts: { page: number; text: string; lines: string[] }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as { str: string }[];
    const rawPageText = items.map((item) => item.str).join(' ');
    const lines = rawPageText
      .split(/\r?\n|(?<=[.?!:])\s{2,}/)
      .map((l) => l.trim())
      .filter(Boolean);

    pageTexts.push({
      page: i,
      text: rawPageText,
      lines: lines.length > 0 ? lines : rawPageText.split('. ').filter(Boolean),
    });
  }

  const detectedEvents: ExtractedAcademicEvent[] = [];
  const detectedSubjects: ExtractedSubject[] = [];

  // Patterns for events
  const examKeywords = /\b(exam|examination|midterm|final|quiz|test|assessment)\b/i;
  const assignmentKeywords = /\b(assignment|project|homework|problem set|submission|lab report|presentation)\b/i;
  const classKeywords = /\b(lecture|lab|seminar|recitation|tutorial|workshop)\b/i;
  const holidayKeywords = /\b(holiday|break|recess|vacation|no class|reading week)\b/i;

  // Patterns for syllabus chapters & units
  const delims = '(?:-|:|#|\\s)?';
  const unitRegex = new RegExp('\\b(?:unit|module|part)\\s*' + delims + '\\s*(\\d+|[ivx]+)[:\\s-]*(.*)', 'i');
  const chapterRegex = new RegExp('\\b(?:chapter|ch\\.|topic|lesson|section)\\s*' + delims + '\\s*(\\d+|[ivx]+)?[:\\s-]*(.*)', 'i');
  const numberedTopicRegex = /^(\d+[\.\)]\s+)(.+)/;

  let currentUnitTitle = 'General';
  const extractedChapters: ExtractedChapter[] = [];

  for (const { page, text, lines } of pageTexts) {
    // 1. Scan for Academic Events
    for (const line of lines) {
      if (line.length < 5 || line.length > 250) continue;

      const foundDate = parseDateString(line);
      if (foundDate) {
        let type: 'exam' | 'assignment' | 'class' | 'holiday' | null = null;
        if (examKeywords.test(line)) type = 'exam';
        else if (assignmentKeywords.test(line)) type = 'assignment';
        else if (holidayKeywords.test(line)) type = 'holiday';
        else if (classKeywords.test(line)) type = 'class';

        if (type) {
          const cleanTitle = line
            .replace(new RegExp(foundDate, 'i'), '')
            .replace(/[()]/g, '')
            .trim();
          detectedEvents.push({
            id: `evt_ext_${Date.now()}_${detectedEvents.length}`,
            title: cleanTitle.length > 3 ? cleanTitle.slice(0, 80) : `${type.toUpperCase()} - ${foundDate}`,
            event_type: type,
            start_date: foundDate,
            source_page: page,
            source_snippet: line.slice(0, 140),
          });
        }
      }
    }

    // 2. Scan for Units / Chapters / Topics
    for (const line of lines) {
      const unitMatch = line.match(unitRegex);
      if (unitMatch) {
        currentUnitTitle = unitMatch[0].slice(0, 50).trim();
        continue;
      }

      const chMatch = line.match(chapterRegex);
      if (chMatch) {
        const titleCandidate = chMatch[2]?.trim() || line;
        if (titleCandidate.length >= 3 && titleCandidate.length < 100) {
          extractedChapters.push({
            id: `ch_ext_${Date.now()}_${extractedChapters.length}`,
            unit_title: currentUnitTitle,
            title: titleCandidate,
            est_min: 60,
            source_page: page,
            source_snippet: line.slice(0, 120),
          });
          continue;
        }
      }

      const numMatch = line.match(numberedTopicRegex);
      if (numMatch && !line.toLowerCase().includes('page') && line.length < 100) {
        const titleCandidate = numMatch[2]?.trim();
        if (titleCandidate && titleCandidate.length >= 4 && !/^\d+$/.test(titleCandidate)) {
          extractedChapters.push({
            id: `ch_ext_${Date.now()}_${extractedChapters.length}`,
            unit_title: currentUnitTitle,
            title: titleCandidate,
            est_min: 60,
            source_page: page,
            source_snippet: line.slice(0, 120),
          });
        }
      }
    }

    // Fallback if no structured chapters found yet, check lines with syllabus structure
    if (extractedChapters.length === 0) {
      // Look for bullet points or list items
      const bulletItems = text
        .split(/(?:•|\*|-|\d+\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 5 && s.length <= 80 && !s.includes('\n'));

      for (const item of bulletItems.slice(0, 20)) {
        if (!examKeywords.test(item) && !item.toLowerCase().includes('copyright')) {
          extractedChapters.push({
            id: `ch_ext_${Date.now()}_${extractedChapters.length}`,
            unit_title: currentUnitTitle,
            title: item,
            est_min: 60,
            source_page: page,
            source_snippet: item,
          });
        }
      }
    }
  }

  // Detect Course/Subject Title
  let subjectName = 'Imported Subject';
  let subjectCode = '';
  const firstPage = pageTexts[0]?.text || '';
  const courseMatch = firstPage.match(/(?:course|subject|syllabus for)\s*[:\-]?\s*([A-Za-z0-9\s,&]{3,40})/i);
  if (courseMatch && courseMatch[1]) {
    subjectName = courseMatch[1].trim();
  } else {
    // Check for code like CS101, CHEM201, MATH300
    const codeMatch = firstPage.match(/\b([A-Z]{2,5}\s?\d{3,4})\b/);
    if (codeMatch) {
      subjectCode = codeMatch[1];
      subjectName = `${subjectCode} Course`;
    }
  }

  // Associate any detected exam date
  const examEvent = detectedEvents.find((e) => e.event_type === 'exam');

  detectedSubjects.push({
    id: `sub_ext_${Date.now()}`,
    name: subjectName,
    code: subjectCode || undefined,
    exam_date: examEvent?.start_date,
    chapters: extractedChapters,
  });

  return {
    subjects: detectedSubjects,
    events: detectedEvents,
    totalPages: numPages,
  };
}
