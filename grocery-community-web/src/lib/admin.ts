import { supabase } from "./supabase";

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return false;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return false;
  return !!profile.is_admin;
}