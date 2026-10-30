import { describe, it, expect } from 'vitest';
import { generateSchedule } from './scheduler';
import type { Subject, Chapter } from '../types/database';

describe('Deterministic Scheduler', () => {
  const baseDate = '2026-11-01';

  it('1. daily cap respected: never exceeds declared daily hours', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        name: 'Physics',
        color_key: '1',
        exam_date: '2026-11-10',
        priority: 2,
        created_at: '2026-11-01T00:00:00Z',
      },
    ];

    // 4 chapters of 60 mins each = 240 mins total work
    const chapters: Chapter[] = [
      { id: 'ch-1', user_id: 'user-1', subject_id: 'sub-1', title: 'Kinematics', est_min: 60, is_done: false, position: 1, created_at: '' },
      { id: 'ch-2', user_id: 'user-1', subject_id: 'sub-1', title: 'Dynamics', est_min: 60, is_done: false, position: 2, created_at: '' },
      { id: 'ch-3', user_id: 'user-1', subject_id: 'sub-1', title: 'Work & Energy', est_min: 60, is_done: false, position: 3, created_at: '' },
      { id: 'ch-4', user_id: 'user-1', subject_id: 'sub-1', title: 'Thermodynamics', est_min: 60, is_done: false, position: 4, created_at: '' },
    ];

    const dailyHours = 2; // 120 minutes cap per day
    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: dailyHours,
        session_min: 45,
        break_min: 10,
        start_date: baseDate,
      },
    });

    const minutesByDate = new Map<string, number>();
    for (const block of result.blocks) {
      const cur = minutesByDate.get(block.date) || 0;
      minutesByDate.set(block.date, cur + block.duration_min);
    }

    expect(minutesByDate.size).toBeGreaterThan(0);
    for (const [date, totalMin] of minutesByDate.entries()) {
      expect(totalMin, `Date ${date} exceeded daily cap`).toBeLessThanOrEqual(dailyHours * 60);
    }
  });

  it('2. deadline ordering: earlier exam deadlines are scheduled first', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-math',
        user_id: 'user-1',
        name: 'Math',
        color_key: '1',
        exam_date: '2026-11-20', // 19 days away
        priority: 2,
        created_at: '',
      },
      {
        id: 'sub-chem',
        user_id: 'user-1',
        name: 'Chemistry',
        color_key: '2',
        exam_date: '2026-11-03', // 2 days away (very high urgency)
        priority: 2,
        created_at: '',
      },
    ];

    const chapters: Chapter[] = [
      { id: 'ch-math', user_id: 'user-1', subject_id: 'sub-math', title: 'Calculus', est_min: 45, is_done: false, position: 1, created_at: '' },
      { id: 'ch-chem', user_id: 'user-1', subject_id: 'sub-chem', title: 'Organic Chem', est_min: 45, is_done: false, position: 1, created_at: '' },
    ];

    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 1, // Only 1 block per day (45m)
        session_min: 45,
        break_min: 10,
        start_date: baseDate,
      },
    });

    expect(result.blocks.length).toBeGreaterThanOrEqual(2);
    expect(result.blocks[0].subject_id).toBe('sub-chem');
  });

  it('3. breaks inserted: consecutive blocks on the same day have break_min between them', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        name: 'Biology',
        color_key: '2',
        exam_date: '2026-11-08',
        priority: 2,
        created_at: '',
      },
      {
        id: 'sub-2',
        user_id: 'user-1',
        name: 'English',
        color_key: '3',
        exam_date: '2026-11-08',
        priority: 2,
        created_at: '',
      },
    ];

    const chapters: Chapter[] = [
      { id: 'ch-bio', user_id: 'user-1', subject_id: 'sub-1', title: 'Genetics', est_min: 45, is_done: false, position: 1, created_at: '' },
      { id: 'ch-eng', user_id: 'user-1', subject_id: 'sub-2', title: 'Poetry', est_min: 45, is_done: false, position: 1, created_at: '' },
    ];

    const breakMin = 15;
    const sessionMin = 45;
    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 3,
        session_min: sessionMin,
        break_min: breakMin,
        start_date: baseDate,
        start_time_min: 540, // 09:00
      },
    });

    const dayBlocks = result.blocks.filter((b) => b.date === baseDate);
    expect(dayBlocks.length).toBe(2);

    const first = dayBlocks[0];
    const second = dayBlocks[1];
    expect(first.start_min).toBe(540);
    expect(second.start_min).toBe(first.start_min + first.duration_min + breakMin);
  });

  it('4. long chapter split across days instead of one marathon', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-history',
        user_id: 'user-1',
        name: 'History',
        color_key: '4',
        exam_date: '2026-11-08', // 7 days away
        priority: 2,
        created_at: '',
      },
    ];

    const chapters: Chapter[] = [
      {
        id: 'ch-world-war',
        user_id: 'user-1',
        subject_id: 'sub-history',
        title: 'World War II',
        est_min: 135,
        is_done: false,
        position: 1,
        created_at: '',
      },
    ];

    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 4,
        session_min: 45,
        break_min: 10,
        start_date: baseDate,
      },
    });

    expect(result.blocks.length).toBe(3);
    const distinctDates = new Set(result.blocks.map((b) => b.date));
    expect(distinctDates.size).toBe(3);
  });

  it('5. deficit reported: unscheduled work triggers calm deficit banner and never overloads a day', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-chem',
        user_id: 'user-1',
        name: 'Chem',
        color_key: '2',
        exam_date: '2026-11-03', // Exam on day 3, so student can only study on Nov 1 & Nov 2 (2 days total)
        priority: 1, // High priority
        created_at: '',
      },
    ];

    const chapters: Chapter[] = [
      {
        id: 'ch-huge',
        user_id: 'user-1',
        subject_id: 'sub-chem',
        title: 'Complete Syllabus',
        est_min: 1200,
        is_done: false,
        position: 1,
        created_at: '',
      },
    ];

    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 0.5, // 30 min daily cap
        session_min: 30,
        break_min: 10,
        start_date: baseDate,
      },
    });

    for (const block of result.blocks) {
      expect(block.duration_min).toBeLessThanOrEqual(30);
    }
    const blocksOnDay1 = result.blocks.filter((b) => b.date === '2026-11-01');
    const day1Total = blocksOnDay1.reduce((sum, b) => sum + b.duration_min, 0);
    expect(day1Total).toBeLessThanOrEqual(30);

    expect(result.deficits.length).toBe(1);
    expect(result.deficits[0].subject_name).toBe('Chem');
    expect(result.deficits[0].message).toContain("won't fit before your Chem exam.");
  });
});
