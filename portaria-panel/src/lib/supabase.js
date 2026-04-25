import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseBucket =
  import.meta.env.VITE_SUPABASE_BUCKET?.trim() || "entregas";

export const hasSupabaseStorage = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseStorage
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
