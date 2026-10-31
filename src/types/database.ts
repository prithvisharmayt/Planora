export interface Profile {
  id: string;
  user_id: string;
  name: string;
  college?: string;
  program?: string;
  daily_hours: number;
  session_min: number;
  break_min: number;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  code?: string | null;
  color_key: '1' | '2' | '3' | '4' | '5' | '6';
  exam_date: string | null; // YYYY-MM-DD or null
  priority: number; // 1 = High, 2 = Medium, 3 = Low, default 2
  confidence?: 1 | 2 | 3; // 1 = Low, 2 = Medium, 3 = High
  weekly_target_min?: number;
  notes?: string | null;
  resource_url?: string | null;
  is_archived?: boolean;
  created_at: string;
}

export type TopicStatus = 'not_started' | 'learning' | 'revising' | 'completed';

export interface Chapter {
  id: string;
  user_id: string;
  subject_id: string;
  unit_title?: string | null;
  title: string;
  est_min: number;
  is_done: boolean;
  status?: TopicStatus;
  notes?: string | null;
  resource_url?: string | null;
  confidence?: 1 | 2 | 3;
  last_studied_date?: string | null;
  completed_focus_min?: number;
  position: number;
  created_at: string;
}

export interface Block {
  id: string;
  user_id: string;
  chapter_id: string;
  subject_id?: string | null;
  date: string; // YYYY-MM-DD
  start_min: number; // minutes from midnight, e.g. 540 = 9:00 AM
  duration_min: number;
  status: 'scheduled' | 'done' | 'missed';
  is_locked?: boolean;
  created_at: string;
}

export type EventType = 'exam' | 'assignment' | 'class' | 'holiday';

export interface AcademicEvent {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  event_type: EventType;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  location?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface FocusLog {
  id: string;
  user_id: string;
  chapter_id: string | null;
  subject_id: string | null;
  block_id?: string | null;
  duration_sec: number;
  session_type: 'pomodoro' | 'short_break' | 'long_break';
  completed_at: string;
  notes?: string | null;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  file_name: string;
  items_count: number;
  events_count: number;
  status: string;
  created_at: string;
}

export interface ScheduleSnapshot {
  id: string;
  user_id: string;
  blocks_json: string;
  reason: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Subject, 'id'>>;
      };
      chapters: {
        Row: Chapter;
        Insert: Omit<Chapter, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Chapter, 'id'>>;
      };
      blocks: {
        Row: Block;
        Insert: Omit<Block, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Block, 'id'>>;
      };
      academic_events: {
        Row: AcademicEvent;
        Insert: Omit<AcademicEvent, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<AcademicEvent, 'id'>>;
      };
      focus_logs: {
        Row: FocusLog;
        Insert: Omit<FocusLog, 'id' | 'completed_at'> & { id?: string; completed_at?: string };
        Update: Partial<Omit<FocusLog, 'id'>>;
      };
      import_batches: {
        Row: ImportBatch;
        Insert: Omit<ImportBatch, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ImportBatch, 'id'>>;
      };
      schedule_snapshots: {
        Row: ScheduleSnapshot;
        Insert: Omit<ScheduleSnapshot, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ScheduleSnapshot, 'id'>>;
      };
    };
  };
}
