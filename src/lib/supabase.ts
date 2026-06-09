import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_KEY
);

export interface GuestbookEntry {
  id: number;
  created_at: string;
  name: string;
  website: string | null;
  message: string;
  likes: number;
  ip: string | null;
}
