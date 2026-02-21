import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Vite replaces import.meta.env at build time. This throws early in dev if missing.
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
