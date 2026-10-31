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
      college: profile.college ?? existing?.college,
      program: profile.program ?? existing?.program,
      daily_hours: profile.daily_hours ?? existing?.daily_hours ?? 3,
      session_min: profile.session_min ?? existing?.session_min ?? 45,
      break_min: profile.break_min ?? existing?.break_min ?? 10,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    const profiles = this.getLocalTab<Profile>('profiles');
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = updated;
    } else {
      profiles.push(updated);
    }
    this.setLocalTab('profiles', profiles);

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
        this.setLocalTab('subjects', res.subjects);
        return res.subjects.filter((s: Subject) => !s.is_archived);
      }
    }
    const subjects = this.getLocalTab<Subject>('subjects');
    return subjects.filter((s) => (!userId || s.user_id === userId || !s.user_id) && !s.is_archived);
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

  async updateSubject(subjectId: string, updates: Partial<Subject>): Promise<void> {
    const subjects = this.getLocalTab<Subject>('subjects');
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx >= 0) {
      subjects[idx] = { ...subjects[idx], ...updates };
      this.setLocalTab('subjects', subjects);
    }
    if (this.isGoogleSheetConnected()) {
      this.callRemote('updateSubject', { subjectId, updates }).catch((e) =>
        console.warn('Sync subject update to Google Sheets error:', e)
      );
    }
  },

  async deleteSubject(subjectId: string, userId: string): Promise<void> {
    // Delete subject
    const subjects = this.getLocalTab<Subject>('subjects');
    this.setLocalTab(
      'subjects',
      subjects.filter((s) => s.id !== subjectId)
    );

    // Delete chapters under this subject
    const chapters = this.getLocalTab<Chapter>('chapters');
    const chapterIdsToDelete = new Set(
      chapters.filter((c) => c.subject_id === subjectId).map((c) => c.id)
    );
    this.setLocalTab(
      'chapters',
      chapters.filter((c) => c.subject_id !== subjectId)
    );

    // Delete blocks under these chapters or subject
    const blocks = this.getLocalTab<Block>('blocks');
    this.setLocalTab(
      'blocks',
      blocks.filter(
        (b) =>
          b.subject_id !== subjectId &&
          !chapterIdsToDelete.has(b.chapter_id)
      )
    );

    // Delete academic events for this subject
    const events = this.getLocalTab<AcademicEvent>('academic_events');
    this.setLocalTab(
      'academic_events',
      events.filter((e) => e.subject_id !== subjectId)
    );

    if (this.isGoogleSheetConnected()) {
      this.callRemote('deleteSubject', { subjectId, userId }).catch((e) =>
        console.warn('Sync deleteSubject to Google Sheets error:', e)
      );
    }
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
    return chapters.filter((c) => !userId || c.user_id === userId || !c.user_id);
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

  async deleteChapter(chapterId: string, _userId: string): Promise<void> {
    const chapters = this.getLocalTab<Chapter>('chapters');
    this.setLocalTab(
      'chapters',
      chapters.filter((c) => c.id !== chapterId)
    );

    // Delete associated blocks
    const blocks = this.getLocalTab<Block>('blocks');
    this.setLocalTab(
      'blocks',
      blocks.filter((b) => b.chapter_id !== chapterId)
    );

    if (this.isGoogleSheetConnected()) {
      this.callRemote('deleteChapter', { chapterId }).catch((e) =>
        console.warn('Sync deleteChapter to Google Sheets error:', e)
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
      .filter((b) => !userId || b.user_id === userId || !b.user_id)
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

  async updateBlock(blockId: string, updates: Partial<Block>): Promise<void> {
    const blocks = this.getLocalTab<Block>('blocks');
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx >= 0) {
      blocks[idx] = { ...blocks[idx], ...updates };
      this.setLocalTab('blocks', blocks);
    }

    if (this.isGoogleSheetConnected()) {
      this.callRemote('updateBlock', { blockId, updates }).catch((e) =>
        console.warn('Sync block update to Google Sheets error:', e)
      );
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
    const existing = this.getLocalTab<Block>('blocks');
    // Keep blocks that belong to another user, or are marked 'done', or date < todayStr, or are locked
    const kept = existing.filter(
      (b) =>
        b.user_id !== userId ||
        b.status === 'done' ||
        b.is_locked ||
        b.date < todayStr
    );

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

  // Academic Events
  async getAcademicEvents(userId: string): Promise<AcademicEvent[]> {
    const events = this.getLocalTab<AcademicEvent>('academic_events');
    return events
      .filter((e) => !userId || e.user_id === userId)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  },

  async createAcademicEvents(
    newEvents: Omit<AcademicEvent, 'id' | 'created_at'>[]
  ): Promise<AcademicEvent[]> {
    const created: AcademicEvent[] = newEvents.map((e, idx) => ({
      ...e,
      id: `evt_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
    }));
    const existing = this.getLocalTab<AcademicEvent>('academic_events');
    this.setLocalTab('academic_events', [...existing, ...created]);
    return created;
  },

  async updateAcademicEvent(id: string, updates: Partial<AcademicEvent>): Promise<void> {
    const events = this.getLocalTab<AcademicEvent>('academic_events');
    const idx = events.findIndex((e) => e.id === id);
    if (idx >= 0) {
      events[idx] = { ...events[idx], ...updates };
      this.setLocalTab('academic_events', events);
    }
  },

  async deleteAcademicEvent(id: string): Promise<void> {
    const events = this.getLocalTab<AcademicEvent>('academic_events');
    this.setLocalTab(
      'academic_events',
      events.filter((e) => e.id !== id)
    );
  },

  // Focus Logs
  async getFocusLogs(userId: string): Promise<FocusLog[]> {
    const logs = this.getLocalTab<FocusLog>('focus_logs');
    return logs
      .filter((l) => !userId || l.user_id === userId)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  },

  async logFocusSession(
    log: Omit<FocusLog, 'id' | 'completed_at'> & { completed_at?: string }
  ): Promise<FocusLog> {
    const newLog: FocusLog = {
      ...log,
      id: `foc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      completed_at: log.completed_at || new Date().toISOString(),
    };
    const existing = this.getLocalTab<FocusLog>('focus_logs');
    this.setLocalTab('focus_logs', [newLog, ...existing]);

    // Also update chapter completed_focus_min if chapter_id is provided
    if (log.chapter_id) {
      const minutes = Math.round(log.duration_sec / 60);
      const chapters = this.getLocalTab<Chapter>('chapters');
      const idx = chapters.findIndex((c) => c.id === log.chapter_id);
      if (idx >= 0) {
        chapters[idx].completed_focus_min = (chapters[idx].completed_focus_min || 0) + minutes;
        chapters[idx].last_studied_date = new Date().toISOString().split('T')[0];
        this.setLocalTab('chapters', chapters);
      }
    }

    return newLog;
  },

  // Import Batches
  async getImportBatches(userId: string): Promise<ImportBatch[]> {
    const batches = this.getLocalTab<ImportBatch>('import_batches');
    return batches
      .filter((b) => !userId || b.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createImportBatch(batch: Omit<ImportBatch, 'id' | 'created_at'>): Promise<ImportBatch> {
    const created: ImportBatch = {
      ...batch,
      id: `batch_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const existing = this.getLocalTab<ImportBatch>('import_batches');
    this.setLocalTab('import_batches', [created, ...existing]);
    return created;
  },

  // Schedule Snapshots
  async getSnapshots(userId: string): Promise<ScheduleSnapshot[]> {
    const snapshots = this.getLocalTab<ScheduleSnapshot>('schedule_snapshots');
    return snapshots
      .filter((s) => !userId || s.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getLatestSnapshot(userId: string): Promise<ScheduleSnapshot | null> {
    const snapshots = await this.getSnapshots(userId);
    return snapshots[0] || null;
  },

  async saveSnapshot(userId: string, blocksJson: string, reason: string): Promise<ScheduleSnapshot> {
    const created: ScheduleSnapshot = {
      id: `snap_${Date.now()}`,
      user_id: userId,
      blocks_json: blocksJson,
      reason,
      created_at: new Date().toISOString(),
    };
    const existing = this.getLocalTab<ScheduleSnapshot>('schedule_snapshots');
    // keep up to 10 snapshots per user
    const updated = [created, ...existing.filter((s) => s.user_id === userId).slice(0, 9)];
    this.setLocalTab('schedule_snapshots', updated);
    return created;
  },

  async restoreSnapshot(snapshotId: string, userId: string): Promise<Block[]> {
    const snapshots = this.getLocalTab<ScheduleSnapshot>('schedule_snapshots');
    const snapshot = snapshots.find((s) => s.id === snapshotId && s.user_id === userId);
    if (!snapshot) throw new Error('Snapshot not found');

    const restoredBlocks: Block[] = JSON.parse(snapshot.blocks_json);
    const allBlocks = this.getLocalTab<Block>('blocks');
    const otherUsersBlocks = allBlocks.filter((b) => b.user_id !== userId);
    this.setLocalTab('blocks', [...otherUsersBlocks, ...restoredBlocks]);

    return restoredBlocks;
  },

  // Clear data
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
    filterOut('academic_events');
    filterOut('focus_logs');
    filterOut('import_batches');
    filterOut('schedule_snapshots');

    if (this.isGoogleSheetConnected()) {
      this.callRemote('clearUserData', { userId }).catch((e) =>
        console.warn('Clear user data in Google Sheets error:', e)
      );
    }
  },

  // Export to CSV helper
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
    const events = this.getLocalTab<AcademicEvent>('academic_events').filter((e) => !userId || e.user_id === userId);
    const logs = this.getLocalTab<FocusLog>('focus_logs').filter((l) => !userId || l.user_id === userId);

    let fullExport = '=== PLANORA STUDY PLAN EXPORT ===\n\n';
    fullExport += '--- SUBJECTS TAB ---\n' + this.exportTableToCsv('subjects', subjects) + '\n\n';
    fullExport += '--- CHAPTERS TAB ---\n' + this.exportTableToCsv('chapters', chapters) + '\n\n';
    fullExport += '--- SCHEDULED BLOCKS TAB ---\n' + this.exportTableToCsv('blocks', blocks) + '\n\n';
    fullExport += '--- ACADEMIC EVENTS TAB ---\n' + this.exportTableToCsv('academic_events', events) + '\n\n';
    fullExport += '--- FOCUS LOGS TAB ---\n' + this.exportTableToCsv('focus_logs', logs) + '\n';

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
