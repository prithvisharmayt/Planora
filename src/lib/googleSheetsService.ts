import type { Profile, Subject, Chapter, Block } from '../types/database';

const GS_URL_STORAGE_KEY = 'planora_google_sheet_url';
const LOCAL_SHEET_KEY_PREFIX = 'planora_sheet_tab_';

export const googleSheetsService = {
  getGoogleSheetUrl(): string {
    const fromStorage = localStorage.getItem(GS_URL_STORAGE_KEY);
    if (fromStorage && fromStorage.trim().startsWith('http')) {
      return fromStorage.trim();
    }
    return import.meta.env.VITE_GOOGLE_SHEETS_URL || '';
  },

  setGoogleSheetUrl(url: string): void {
    if (url && url.trim().startsWith('http')) {
      localStorage.setItem(GS_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(GS_URL_STORAGE_KEY);
    }
  },

  isGoogleSheetConnected(): boolean {
    const url = this.getGoogleSheetUrl();
    return Boolean(url && url.includes('script.google.com'));
  },

  // Local Sheet Store (simulates Google Sheet tabs in browser)
  getLocalTab<T>(tabName: string): T[] {
    try {
      const raw = localStorage.getItem(LOCAL_SHEET_KEY_PREFIX + tabName);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  setLocalTab<T>(tabName: string, rows: T[]): void {
    try {
      localStorage.setItem(LOCAL_SHEET_KEY_PREFIX + tabName, JSON.stringify(rows));
    } catch (err) {
      console.error(`Failed to write local sheet tab ${tabName}:`, err);
    }
  },

  // Remote Web App API call
  async callRemote(action: string, payload: Record<string, any> = {}): Promise<any> {
    const url = this.getGoogleSheetUrl();
    if (!url) return null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Apps script CORS standard
        },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) {
        throw new Error(`Google Sheets HTTP Error: ${response.statusText}`);
      }

      const res = await response.json();
      if (!res.success) {
        throw new Error(res.error || 'Google Sheets API returned an error');
      }
      return res;
    } catch (err) {
      console.warn('Google Sheets API call failed, falling back to local sheet:', err);
      return null;
    }
  },

  // Profiles
  async getProfile(userId: string): Promise<Profile | null> {
    if (this.isGoogleSheetConnected()) {
      const res = await this.callRemote('getAll', { userId });
      if (res && res.profile) return res.profile;
    }
    const profiles = this.getLocalTab<Profile>('profiles');
    return profiles.find((p) => p.id === userId || p.user_id === userId) || null;
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    const existing = await this.getProfile(profile.id);
    const updated: Profile = {
      id: profile.id,
      user_id: profile.id,
      name: profile.name ?? existing?.name ?? 'Student',
      daily_hours: profile.daily_hours ?? existing?.daily_hours ?? 3,
      session_min: profile.session_min ?? existing?.session_min ?? 45,
      break_min: profile.break_min ?? existing?.break_min ?? 10,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    // Save locally
    const profiles = this.getLocalTab<Profile>('profiles');
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = updated;
    } else {
      profiles.push(updated);
    }
    this.setLocalTab('profiles', profiles);

    // Sync to remote if connected
    if (this.isGoogleSheetConnected()) {
      this.callRemote('upsertProfile', { profile: updated }).catch((e) =>
        console.warn('Sync profile to Google Sheets error:', e)
      );
    }

    return updated;
  },

  // Subjects
  async getSubjects(userId: string): Promise<Subject[]> {
    if (this.isGoogleSheetConnected()) {
      const res = await this.callRemote('getAll', { userId });
      if (res && res.subjects && res.subjects.length > 0) {
        // Cache to local tab
        this.setLocalTab('subjects', res.subjects);
        return res.subjects;
      }
    }
    const subjects = this.getLocalTab<Subject>('subjects');
    return subjects.filter((s) => !userId || s.user_id === userId);
  },

  async createSubjects(newSubjects: Omit<Subject, 'id' | 'created_at'>[]): Promise<Subject[]> {
    const created: Subject[] = newSubjects.map((s, idx) => ({
      ...s,
      id: `sub_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));

    const existing = this.getLocalTab<Subject>('subjects');
    const combined = [...existing, ...created];
    this.setLocalTab('subjects', combined);

    if (this.isGoogleSheetConnected()) {
      this.callRemote('saveSubjects', { subjects: created }).catch((e) =>
        console.warn('Sync subjects to Google Sheets error:', e)
      );
    }

    return created;
  },

  // Chapters
  async getChapters(userId: string): Promise<Chapter[]> {
    if (this.isGoogleSheetConnected()) {
      const res = await this.callRemote('getAll', { userId });
      if (res && res.chapters && res.chapters.length > 0) {
        this.setLocalTab('chapters', res.chapters);
        return res.chapters;
      }
    }
    const chapters = this.getLocalTab<Chapter>('chapters');
    return chapters.filter((c) => !userId || c.user_id === userId);
  },

  async createChapters(newChapters: Omit<Chapter, 'id' | 'created_at'>[]): Promise<Chapter[]> {
    const created: Chapter[] = newChapters.map((c, idx) => ({
      ...c,
      id: `ch_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));

    const existing = this.getLocalTab<Chapter>('chapters');
    const combined = [...existing, ...created];
    this.setLocalTab('chapters', combined);

    if (this.isGoogleSheetConnected()) {
      this.callRemote('saveChapters', { chapters: created }).catch((e) =>
        console.warn('Sync chapters to Google Sheets error:', e)
      );
    }

    return created;
  },

  async updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<void> {
    const chapters = this.getLocalTab<Chapter>('chapters');
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx >= 0) {
      chapters[idx] = { ...chapters[idx], ...updates };
      this.setLocalTab('chapters', chapters);
    }

    if (this.isGoogleSheetConnected()) {
      this.callRemote('updateChapter', { chapterId, updates }).catch((e) =>
        console.warn('Sync chapter update to Google Sheets error:', e)
      );
    }
  },

  // Blocks
  async getBlocks(userId: string): Promise<Block[]> {
    if (this.isGoogleSheetConnected()) {
      const res = await this.callRemote('getAll', { userId });
      if (res && res.blocks && res.blocks.length > 0) {
        this.setLocalTab('blocks', res.blocks);
        return res.blocks;
      }
    }
    const blocks = this.getLocalTab<Block>('blocks');
    return blocks
      .filter((b) => !userId || b.user_id === userId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_min - b.start_min);
  },

  async createBlocks(newBlocks: Omit<Block, 'id' | 'created_at'>[]): Promise<Block[]> {
    const created: Block[] = newBlocks.map((b, idx) => ({
      ...b,
      id: `blk_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));

    const existing = this.getLocalTab<Block>('blocks');
    const combined = [...existing, ...created];
    this.setLocalTab('blocks', combined);

    if (this.isGoogleSheetConnected()) {
      this.callRemote('saveBlocks', { blocks: created }).catch((e) =>
        console.warn('Sync blocks to Google Sheets error:', e)
      );
    }

    return created;
  },

  async updateBlockStatus(blockId: string, status: 'scheduled' | 'done' | 'missed'): Promise<void> {
    const blocks = this.getLocalTab<Block>('blocks');
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx >= 0) {
      blocks[idx].status = status;
      this.setLocalTab('blocks', blocks);
    }

    if (this.isGoogleSheetConnected()) {
      this.callRemote('updateBlockStatus', { blockId, status }).catch((e) =>
        console.warn('Sync block status to Google Sheets error:', e)
      );
    }
  },

  async replaceIncompleteBlocks(userId: string, todayStr: string, newBlocks: Omit<Block, 'id' | 'created_at'>[]): Promise<Block[]> {
    const existing = this.getLocalTab<Block>('blocks');
    // Keep blocks that belong to another user, or are marked 'done', or date < todayStr
    const kept = existing.filter((b) => b.user_id !== userId || b.status === 'done' || b.date < todayStr);

    const created: Block[] = newBlocks.map((b, idx) => ({
      ...b,
      id: `blk_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));

    const combined = [...kept, ...created];
    this.setLocalTab('blocks', combined);

    if (this.isGoogleSheetConnected()) {
      this.callRemote('replaceIncompleteBlocks', { userId, todayStr, newBlocks: created }).catch((e) =>
        console.warn('Sync replace blocks to Google Sheets error:', e)
      );
    }

    return created;
  },

  async clearUserData(userId: string): Promise<void> {
    const filterOut = <T extends { user_id?: string; id?: string }>(tab: string) => {
      const rows = this.getLocalTab<T>(tab);
      const filtered = rows.filter((r) => r.user_id !== userId && r.id !== userId);
      this.setLocalTab(tab, filtered);
    };

    filterOut('profiles');
    filterOut('subjects');
    filterOut('chapters');
    filterOut('blocks');

    if (this.isGoogleSheetConnected()) {
      this.callRemote('clearUserData', { userId }).catch((e) =>
        console.warn('Clear user data in Google Sheets error:', e)
      );
    }
  },

  // Export to CSV helper for opening directly in Google Sheets / Excel
  exportTableToCsv<T extends Record<string, any>>(tabName: string, rows: T[]): string {
    if (rows.length === 0) return `${tabName} (Empty)\n`;
    const headers = Object.keys(rows[0]);
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
    return lines.join('\n');
  },

  downloadAllAsCsv(userId: string): void {
    const subjects = this.getLocalTab<Subject>('subjects').filter((s) => !userId || s.user_id === userId);
    const chapters = this.getLocalTab<Chapter>('chapters').filter((c) => !userId || c.user_id === userId);
    const blocks = this.getLocalTab<Block>('blocks').filter((b) => !userId || b.user_id === userId);

    let fullExport = '=== PLANORA GOOGLE SHEETS EXPORT ===\n\n';
    fullExport += '--- SUBJECTS TAB ---\n' + this.exportTableToCsv('subjects', subjects) + '\n\n';
    fullExport += '--- CHAPTERS TAB ---\n' + this.exportTableToCsv('chapters', chapters) + '\n\n';
    fullExport += '--- SCHEDULED BLOCKS TAB ---\n' + this.exportTableToCsv('blocks', blocks) + '\n';

    const blob = new Blob([fullExport], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `planora_study_plan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

