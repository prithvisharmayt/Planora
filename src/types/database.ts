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
  color_key: '1' | '2' | '3' | '4' | '5' | '6';
  exam_date: string | null; // YYYY-MM-DD or null
  priority: number; // 1 = High, 2 = Medium, 3 = Low, default 2
  created_at: string;
}

export interface Chapter {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  est_min: number;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface Block {
  id: string;
  user_id: string;
  chapter_id: string;
  date: string; // YYYY-MM-DD
  start_min: number; // minutes from midnight, e.g. 540 = 9:00 AM
  duration_min: number;
  status: 'scheduled' | 'done' | 'missed';
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
    };
  };
}
