import { supabase, isSupabaseConfigured } from './supabase';
import { googleSheetsService } from './googleSheetsService';
import type {
  Profile,
  Subject,
  Chapter,
  Block,
  AcademicEvent,
  FocusLog,
  ImportBatch,
  ScheduleSnapshot,
} from '../types/database';

export const dataService = {
  // Profiles
  async getProfile(userId: string): Promise<Profile | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn('Supabase getProfile failed:', err);
      }
    }
    return googleSheetsService.getProfile(userId);
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    const localProfile = await googleSheetsService.upsertProfile(profile);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .upsert({
            id: profile.id,
            user_id: profile.id,
            name: profile.name,
            college: profile.college,
            program: profile.program,
            daily_hours: profile.daily_hours,
            session_min: profile.session_min ?? 45,
            break_min: profile.break_min ?? 10,
          })
          .select()
          .maybeSingle();

        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn('Supabase upsertProfile failed, using sheet store:', err);
      }
    }
    return localProfile;
  },

  // Subjects
  async getSubjects(userId: string): Promise<Subject[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const filtered = (data as Subject[]).filter((s) => !s.is_archived);
          if (filtered.length > 0) return filtered;
        }
      } catch (err) {
        console.warn('Supabase getSubjects failed:', err);
      }
    }
    return googleSheetsService.getSubjects(userId);
  },

  async createSubjects(subjects: Omit<Subject, 'id' | 'created_at'>[]): Promise<Subject[]> {
    // Always create in local storage first
    const localSubs = await googleSheetsService.createSubjects(subjects);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('subjects') as any)
          .insert(subjects)
          .select();

        if (!error && data && data.length > 0) {
          return data as Subject[];
        }
        if (error) {
          console.warn('Supabase createSubjects warning, falling back to local:', error.message);
        }
      } catch (err) {
        console.warn('Supabase createSubjects failed, using sheet store:', err);
      }
    }
    return localSubs;
  },

  async updateSubject(subjectId: string, updates: Partial<Subject>): Promise<void> {
    await googleSheetsService.updateSubject(subjectId, updates);
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('subjects') as any)
          .update(updates)
          .eq('id', subjectId);
      } catch (err) {
        console.warn('Supabase updateSubject error:', err);
      }
    }
  },

  async deleteSubject(subjectId: string, userId: string): Promise<void> {
    await googleSheetsService.deleteSubject(subjectId, userId);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('subjects').delete().eq('id', subjectId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteSubject error:', err);
      }
    }
  },

  // Chapters
  async getChapters(userId: string): Promise<Chapter[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .eq('user_id', userId)
          .order('position', { ascending: true });

        if (!error && data && data.length > 0) return data as Chapter[];
      } catch (err) {
        console.warn('Supabase getChapters error:', err);
      }
    }
    return googleSheetsService.getChapters(userId);
  },

  async createChapters(chapters: Omit<Chapter, 'id' | 'created_at'>[]): Promise<Chapter[]> {
    const localChs = await googleSheetsService.createChapters(chapters);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('chapters') as any)
          .insert(chapters)
          .select();

        if (!error && data && data.length > 0) return data as Chapter[];
        if (error) {
          console.warn('Supabase createChapters warning, falling back to local:', error.message);
        }
      } catch (err) {
        console.warn('Supabase createChapters failed, using sheet store:', err);
      }
    }
    return localChs;
  },

  async updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<void> {
    await googleSheetsService.updateChapter(chapterId, updates);
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('chapters') as any)
          .update(updates)
          .eq('id', chapterId);
      } catch (err) {
        console.warn('Supabase updateChapter error:', err);
      }
    }
  },

  async deleteChapter(chapterId: string, userId: string): Promise<void> {
    await googleSheetsService.deleteChapter(chapterId, userId);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('chapters').delete().eq('id', chapterId).eq('user_id', userId);
      } catch (err) {
        console.warn('Supabase deleteChapter error:', err);
      }
    }
  },

  // Blocks
  async getBlocks(userId: string): Promise<Block[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('blocks')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .order('start_min', { ascending: true });

        if (!error && data && data.length > 0) return data as Block[];
      } catch (err) {
        console.warn('Supabase getBlocks error:', err);
      }
    }
    return googleSheetsService.getBlocks(userId);
  },

  async createBlocks(blocks: Omit<Block, 'id' | 'created_at'>[]): Promise<Block[]> {
    const localBlks = await googleSheetsService.createBlocks(blocks);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('blocks') as any)
          .insert(blocks)
          .select();

        if (!error && data && data.length > 0) return data as Block[];
        if (error) {
          console.warn('Supabase createBlocks warning, falling back to local:', error.message);
        }
      } catch (err) {
        console.warn('Supabase createBlocks error:', err);
      }
    }
    return localBlks;
  },

  async updateBlock(blockId: string, updates: Partial<Block>): Promise<void> {
    await googleSheetsService.updateBlock(blockId, updates);
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('blocks') as any)
          .update(updates)
          .eq('id', blockId);
      } catch (err) {
        console.warn('Supabase updateBlock error:', err);
      }
    }
  },

  async updateBlockStatus(blockId: string, status: 'scheduled' | 'done' | 'missed'): Promise<void> {
    return this.updateBlock(blockId, { status });
  },

  async replaceIncompleteBlocks(
    userId: string,
    todayStr: string,
    newBlocks: Omit<Block, 'id' | 'created_at'>[]
  ): Promise<Block[]> {
    const localBlks = await googleSheetsService.replaceIncompleteBlocks(userId, todayStr, newBlocks);

    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('blocks') as any)
          .delete()
          .eq('user_id', userId)
          .neq('status', 'done')
          .neq('is_locked', true)
          .gte('date', todayStr);

        if (newBlocks.length > 0) {
          const { data } = await (supabase.from('blocks') as any)
            .insert(newBlocks)
            .select();

          if (data && data.length > 0) return data as Block[];
        }
      } catch (err) {
        console.warn('Supabase replaceIncompleteBlocks error:', err);
      }
    }
    return localBlks;
  },

  // Academic Events
  async getAcademicEvents(userId: string): Promise<AcademicEvent[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('academic_events')
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: true });

        if (!error && data && data.length > 0) return data as AcademicEvent[];
      } catch (err) {
        console.warn('Supabase getAcademicEvents error:', err);
      }
    }
    return googleSheetsService.getAcademicEvents(userId);
  },

  async createAcademicEvents(
    events: Omit<AcademicEvent, 'id' | 'created_at'>[]
  ): Promise<AcademicEvent[]> {
    const localEvts = await googleSheetsService.createAcademicEvents(events);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('academic_events') as any)
          .insert(events)
          .select();

        if (!error && data && data.length > 0) return data as AcademicEvent[];
      } catch (err) {
        console.warn('Supabase createAcademicEvents error:', err);
      }
    }
    return localEvts;
  },

  async updateAcademicEvent(id: string, updates: Partial<AcademicEvent>): Promise<void> {
    await googleSheetsService.updateAcademicEvent(id, updates);
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('academic_events') as any)
          .update(updates)
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase updateAcademicEvent error:', err);
      }
    }
  },

  async deleteAcademicEvent(id: string): Promise<void> {
    await googleSheetsService.deleteAcademicEvent(id);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('academic_events').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteAcademicEvent error:', err);
      }
    }
  },

  // Focus Logs
  async getFocusLogs(userId: string): Promise<FocusLog[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('focus_logs')
          .select('*')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false });

        if (!error && data && data.length > 0) return data as FocusLog[];
      } catch (err) {
        console.warn('Supabase getFocusLogs error:', err);
      }
    }
    return googleSheetsService.getFocusLogs(userId);
  },

  async logFocusSession(
    log: Omit<FocusLog, 'id' | 'completed_at'> & { completed_at?: string }
  ): Promise<FocusLog> {
    const localLog = await googleSheetsService.logFocusSession(log);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('focus_logs') as any)
          .insert([log])
          .select()
          .single();

        if (!error && data) {
          if (log.chapter_id) {
            const minutes = Math.round(log.duration_sec / 60);
            await (supabase.rpc as any)('increment_chapter_focus', {
              p_chapter_id: log.chapter_id,
              p_minutes: minutes,
            }).catch(() => {});
          }
          return data as FocusLog;
        }
      } catch (err) {
        console.warn('Supabase logFocusSession error:', err);
      }
    }
    return localLog;
  },

  // Import Batches
  async getImportBatches(userId: string): Promise<ImportBatch[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('import_batches')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) return data as ImportBatch[];
      } catch (err) {
        console.warn('Supabase getImportBatches error:', err);
      }
    }
    return googleSheetsService.getImportBatches(userId);
  },

  async createImportBatch(batch: Omit<ImportBatch, 'id' | 'created_at'>): Promise<ImportBatch> {
    const localBatch = await googleSheetsService.createImportBatch(batch);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('import_batches') as any)
          .insert([batch])
          .select()
          .single();

        if (!error && data) return data as ImportBatch;
      } catch (err) {
        console.warn('Supabase createImportBatch error:', err);
      }
    }
    return localBatch;
  },

  // Schedule Snapshots
  async getLatestSnapshot(userId: string): Promise<ScheduleSnapshot | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('schedule_snapshots')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) return data as ScheduleSnapshot;
      } catch (err) {
        console.warn('Supabase getLatestSnapshot error:', err);
      }
    }
    return googleSheetsService.getLatestSnapshot(userId);
  },

  async saveSnapshot(userId: string, blocksJson: string, reason: string): Promise<ScheduleSnapshot> {
    const localSnap = await googleSheetsService.saveSnapshot(userId, blocksJson, reason);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('schedule_snapshots') as any)
          .insert([{ user_id: userId, blocks_json: blocksJson, reason }])
          .select()
          .single();

        if (!error && data) return data as ScheduleSnapshot;
      } catch (err) {
        console.warn('Supabase saveSnapshot error:', err);
      }
    }
    return localSnap;
  },

  async restoreSnapshot(snapshotId: string, userId: string): Promise<Block[]> {
    const localRestored = await googleSheetsService.restoreSnapshot(snapshotId, userId);

    if (isSupabaseConfigured()) {
      try {
        const { data: snap } = await (supabase.from('schedule_snapshots') as any)
          .select('*')
          .eq('id', snapshotId)
          .single();

        if (snap) {
          const restored: Block[] = JSON.parse((snap as any).blocks_json);
          await supabase.from('blocks').delete().eq('user_id', userId);
          if (restored.length > 0) {
            await (supabase.from('blocks') as any).insert(restored);
          }
          return restored;
        }
      } catch (err) {
        console.warn('Supabase restoreSnapshot error:', err);
      }
    }
    return localRestored;
  },

  async clearUserData(userId: string): Promise<void> {
    await googleSheetsService.clearUserData(userId);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('blocks').delete().eq('user_id', userId);
        await supabase.from('academic_events').delete().eq('user_id', userId);
        await supabase.from('chapters').delete().eq('user_id', userId);
        await supabase.from('subjects').delete().eq('user_id', userId);
        await supabase.from('focus_logs').delete().eq('user_id', userId);
        await supabase.from('import_batches').delete().eq('user_id', userId);
        await supabase.from('schedule_snapshots').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.warn('Supabase clearUserData error:', err);
      }
    }
  },

  exportToGoogleSheetsCsv(userId: string): void {
    googleSheetsService.downloadAllAsCsv(userId);
  },
};
