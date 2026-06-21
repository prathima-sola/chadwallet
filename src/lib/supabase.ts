// Browser-side Supabase client (anon key — safe to expose)
// Use this in client components for read-only queries.
// Writes go through API routes that use the server client.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anonKey) {
  throw new Error("Missing Supabase env vars. Check .env.local");
}

export const supabase = createClient<Database>(url, anonKey);
