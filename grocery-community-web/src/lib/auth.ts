import { supabase } from "./supabase";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;

  return { id: u.id, email: u.email ?? null };
}

export async function signOut() {
  // "local" guarantees the browser session is cleared even if network calls fail
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
