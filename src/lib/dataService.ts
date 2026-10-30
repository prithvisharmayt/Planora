import { supabase, isSupabaseConfigured } from './supabase';
import { googleSheetsService } from './googleSheetsService';
import type { Profile, Subject, Chapter, Block } from '../types/database';

export const dataService = {
  // Profiles
  async getProfile(userId: string): Promise<Profile | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) return data as Profile;
    }
    return googleSheetsService.getProfile(userId);
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .upsert({
            id: profile.id,
            user_id: profile.id,
            name: profile.name,
            daily_hours: profile.daily_hours,
            session_min: profile.session_min ?? 45,
            break_min: profile.break_min ?? 10,
          })
          .select()
          .single();

        if (!error && data) return data as Profile;
      } catch (err) {
        console.warn('Supabase upsertProfile failed, using sheet store:', err);
      }
    }
    return googleSheetsService.upsertProfile(profile);
  },

  // Subjects
  async getSubjects(userId: string): Promise<Subject[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) return (data as Subject[]) || [];
    }
    return googleSheetsService.getSubjects(userId);
  },

  async createSubjects(subjects: Omit<Subject, 'id' | 'created_at'>[]): Promise<Subject[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('subjects') as any)
          .insert(subjects)
          .select();

        if (!error && data) return (data as Subject[]) || [];
      } catch (err) {
        console.warn('Supabase createSubjects failed, using sheet store:', err);
      }
    }
    return googleSheetsService.createSubjects(subjects);
  },

  // Chapters
  async getChapters(userId: string): Promise<Chapter[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });

      if (!error && data) return (data as Chapter[]) || [];
    }
    return googleSheetsService.getChapters(userId);
  },

  async createChapters(chapters: Omit<Chapter, 'id' | 'created_at'>[]): Promise<Chapter[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('chapters') as any)
          .insert(chapters)
          .select();

        if (!error && data) return (data as Chapter[]) || [];
      } catch (err) {
        console.warn('Supabase createChapters failed, using sheet store:', err);
      }
    }
    return googleSheetsService.createChapters(chapters);
  },

  async updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('chapters') as any)
          .update(updates)
          .eq('id', chapterId);
      } catch (err) {
        console.warn('Supabase updateChapter error:', err);
      }
    }
    return googleSheetsService.updateChapter(chapterId, updates);
  },

  // Blocks
  async getBlocks(userId: string): Promise<Block[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('blocks')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .order('start_min', { ascending: true });

      if (!error && data) return (data as Block[]) || [];
    }
    return googleSheetsService.getBlocks(userId);
  },

  async createBlocks(blocks: Omit<Block, 'id' | 'created_at'>[]): Promise<Block[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase.from('blocks') as any)
          .insert(blocks)
          .select();

        if (!error && data) return (data as Block[]) || [];
      } catch (err) {
        console.warn('Supabase createBlocks error:', err);
      }
    }
    return googleSheetsService.createBlocks(blocks);
  },

  async updateBlockStatus(blockId: string, status: 'scheduled' | 'done' | 'missed'): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('blocks') as any)
          .update({ status })
          .eq('id', blockId);
      } catch (err) {
        console.warn('Supabase updateBlockStatus error:', err);
      }
    }
    return googleSheetsService.updateBlockStatus(blockId, status);
  },

  async replaceIncompleteBlocks(userId: string, todayStr: string, newBlocks: Omit<Block, 'id' | 'created_at'>[]): Promise<Block[]> {
    if (isSupabaseConfigured()) {
      try {
        await (supabase.from('blocks') as any)
          .delete()
          .eq('user_id', userId)
          .neq('status', 'done')
          .gte('date', todayStr);

        if (newBlocks.length === 0) return [];

        const { data, error } = await (supabase.from('blocks') as any)
          .insert(newBlocks)
          .select();

        if (!error && data) return (data as Block[]) || [];
      } catch (err) {
        console.warn('Supabase replaceIncompleteBlocks error:', err);
      }
    }
    return googleSheetsService.replaceIncompleteBlocks(userId, todayStr, newBlocks);
  },

  async clearUserData(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('blocks').delete().eq('user_id', userId);
        await supabase.from('chapters').delete().eq('user_id', userId);
        await supabase.from('subjects').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.warn('Supabase clearUserData error:', err);
      }
    }
    return googleSheetsService.clearUserData(userId);
  },

  exportToGoogleSheetsCsv(userId: string): void {
    googleSheetsService.downloadAllAsCsv(userId);
  },
};
