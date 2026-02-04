import { createClient } from '@supabase/supabase-js';

export const SINGLE_SESSION_LS_KEY = 'single_session_lock';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL="https://qfjfrreluuhyxrwtzajv.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY="sb_publishable_7vIfJJpkK0HvclxDDTHMSg_sKo_JDqw";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
