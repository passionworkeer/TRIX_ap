import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Profile {
  id: string;
  username: string;
  points: number;
  avatar_config: {
    head: string;
    body: string;
    legs: string;
    accessory: string;
  };
  created_at: string;
  updated_at: string;
}

export interface TaskHistory {
  id: string;
  user_id: string;
  task_type: string;
  task_description: string | null;
  points_earned: number;
  status: string;
  created_at: string;
}
