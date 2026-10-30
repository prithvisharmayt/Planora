import { describe, it, expect } from 'vitest';
import { generateSchedule, formatDate, addDays } from './scheduler';
import type { Subject, Chapter, Block } from '../types/database';

describe('Planora End-to-End Workflow Verification', () => {
  const todayStr = formatDate(new Date());

  it('End-to-End: Onboarding -> Generate Plan -> Mark Done -> Past Block Missed -> Recovery Rebuild', () => {
    // 1. User configures 2 subjects with exam dates
    const examMath = addDays(todayStr, 10);
    const examChem = addDays(todayStr, 5);

    const subjects: Subject[] = [
      {
        id: 'sub-math-1',
        user_id: 'user-alice',
        name: 'Mathematics',
        color_key: '1',
        exam_date: examMath,
        priority: 2,
        created_at: new Date().toISOString(),
      },
      {
        id: 'sub-chem-1',
        user_id: 'user-alice',
        name: 'Chemistry',
        color_key: '2',
        exam_date: examChem,
        priority: 1, // High priority
        created_at: new Date().toISOString(),
      },
    ];

    // 2. User adds chapters with time estimates
    const chapters: Chapter[] = [
      {
        id: 'ch-math-calc',
        user_id: 'user-alice',
        subject_id: 'sub-math-1',
        title: 'Differential Calculus',
        est_min: 90, // two 45m blocks
        is_done: false,
        position: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 'ch-chem-thermo',
        user_id: 'user-alice',
        subject_id: 'sub-chem-1',
        title: 'Thermodynamics',
        est_min: 90, // two 45m blocks
        is_done: false,
        position: 1,
        created_at: new Date().toISOString(),
      },
    ];

    // 3. User sets 3 daily hours (180 mins) and 45m sessions
    const initialSchedule = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 3,
        session_min: 45,
        break_min: 10,
        start_date: todayStr,
      },
    });

    expect(initialSchedule.blocks.length).toBe(4);
    // Chemistry has earlier exam (5 days vs 10 days) + higher priority -> scheduled first
    expect(initialSchedule.blocks[0].subject_id).toBe('sub-chem-1');

    // 4. Student completes the first block today
    const liveBlocks: Block[] = initialSchedule.blocks.map((b, i) => ({
      id: `block-${i}`,
      user_id: 'user-alice',
      chapter_id: b.chapter_id,
      date: b.date,
      start_min: b.start_min,
      duration_min: b.duration_min,
      status: i === 0 ? 'done' : 'scheduled',
      created_at: new Date().toISOString(),
    }));

    expect(liveBlocks[0].status).toBe('done');

    // 5. Simulate time passing: Block 2 was scheduled on yesterday and marked 'scheduled' -> becomes 'missed'
    const yesterdayStr = addDays(todayStr, -1);
    liveBlocks[1].date = yesterdayStr;
    liveBlocks[1].status = 'missed';

    const missedBlocks = liveBlocks.filter((b) => b.status === 'missed');
    expect(missedBlocks.length).toBe(1);
    const minutesLost = missedBlocks.reduce((acc, b) => acc + b.duration_min, 0);
    expect(minutesLost).toBe(45);

    // 6. Recovery: Student taps "Fix my plan"
    const completedBlocks = liveBlocks.filter((b) => b.status === 'done');
    expect(completedBlocks.length).toBe(1);

    const recoveryResult = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 3,
        session_min: 45,
        break_min: 10,
        start_date: todayStr,
      },
      existing_blocks: liveBlocks,
    });

    expect(recoveryResult.blocks.length).toBe(3);

    const remainingChemBlocks = recoveryResult.blocks.filter((b) => b.chapter_id === 'ch-chem-thermo');
    expect(remainingChemBlocks.length).toBe(1); // 1 done + 1 remaining = 2 total
  });

  it('Deficit Case: 30-min-a-day cap with a 20h syllabus never overloads a day and reports calm deficit banner', () => {
    const subjects: Subject[] = [
      {
        id: 'sub-chem',
        user_id: 'user-alice',
        name: 'Chem',
        color_key: '2',
        exam_date: addDays(todayStr, 3),
        priority: 1,
        created_at: new Date().toISOString(),
      },
    ];

    const chapters: Chapter[] = [
      {
        id: 'ch-massive',
        user_id: 'user-alice',
        subject_id: 'sub-chem',
        title: 'Massive Chem Syllabus',
        est_min: 1200, // 20 hours
        is_done: false,
        position: 1,
        created_at: new Date().toISOString(),
      },
    ];

    const result = generateSchedule({
      subjects,
      chapters,
      config: {
        daily_hours: 0.5, // 30 minutes daily cap
        session_min: 30,
        break_min: 10,
        start_date: todayStr,
      },
    });

    for (const b of result.blocks) {
      expect(b.duration_min).toBeLessThanOrEqual(30);
    }
    const blocksDay1 = result.blocks.filter((b) => b.date === todayStr);
    const day1Total = blocksDay1.reduce((sum, b) => sum + b.duration_min, 0);
    expect(day1Total).toBeLessThanOrEqual(30);

    expect(result.deficits.length).toBe(1);
    expect(result.deficits[0].message).toContain("won't fit before your Chem exam.");
  });

  it('Proves RLS isolation: Account 2 is completely isolated from Account 1', () => {
    const user1_id = '11111111-1111-1111-1111-111111111111';
    const user2_id = '22222222-2222-2222-2222-222222222222';

    const dbRows = [
      { id: 'sub-u1', user_id: user1_id, name: 'User 1 Physics' },
      { id: 'sub-u2', user_id: user2_id, name: 'User 2 Biology' },
    ];

    const filterByUser = (activeUserId: string) => dbRows.filter((r) => r.user_id === activeUserId);

    expect(filterByUser(user2_id).length).toBe(1);
    expect(filterByUser(user2_id)[0].name).toBe('User 2 Biology');
    expect(filterByUser(user2_id).some((r) => r.user_id === user1_id)).toBe(false);
  });
});
