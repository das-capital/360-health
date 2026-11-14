import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until the two values in .env.local are filled in. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | undefined;

/** The one Supabase client used in the browser. Row-level security does the guarding. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not set up. Fill in .env.local and restart the app.");
  }
  client ??= createBrowserClient(url, key);
  return client;
}

/** The logged-in user's id, read from the saved session (no network call). */
export async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("You are signed out. Please log in again.");
  return id;
}
