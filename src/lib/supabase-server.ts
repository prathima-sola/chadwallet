// Server-side Supabase client. NEVER expose the service role key to the browser.
// Use this ONLY in API routes and Server Actions.
// The service role key bypasses Row Level Security.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createServerSupabase() {
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role env vars. Check .env.local");
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
