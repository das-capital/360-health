import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Supabase as the logged-in user, read from the request's cookies.
 * Row-level security applies exactly as it does in the browser.
 */
export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Cookies cannot always be written here; the proxy refreshes the session anyway.
        }
      },
    },
  });
}

/**
 * Supabase with the SECRET key, which bypasses row-level security.
 * Only for the scheduled reminder job, which runs with nobody logged in.
 * Never import this from anything that runs in the browser.
 */
export function adminClient(): SupabaseClient {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_SECRET_KEY is not set on the server.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
