import { NextResponse, type NextRequest } from "next/server";
import { isLogicalDate, logicalDate } from "@/lib/logical-date";
import { userClient } from "@/lib/server/supabase";

/**
 * Saves a mobility answer for one day. Used by the Yes / No buttons on the
 * morning notification, which run without the app being open. It acts as the
 * logged-in user (from the cookies), so row-level security still applies.
 */
export async function POST(request: NextRequest) {
  const supabase = await userClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { date?: unknown; done?: unknown } | null;
  const date = body?.date;
  const done = body?.done;
  if (typeof date !== "string" || !isLogicalDate(date) || date > logicalDate() || typeof done !== "boolean") {
    return NextResponse.json({ error: "Needs a past or current date and done: true or false." }, { status: 400 });
  }

  const { error } = await supabase
    .from("mobility")
    .upsert(
      { user_id: auth.user.id, date, done, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
