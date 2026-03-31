import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Profile {
  id: string;
  username: string;
  email?: string;
  points?: number;
  avatar_config?: Record<string, unknown>;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  website?: string;
  bio?: string;
  is_studying?: boolean;
  companion_id?: string | null;
  total_study_time?: number;
  last_active_at?: string | null;
  show_online_status?: boolean;
  current_streak?: number;
  days_active?: number;
  interaction_count?: number;
  school?: string;
  grade?: string;
  created_at?: string;
  updated_at?: string;
}
