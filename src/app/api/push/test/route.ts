import { NextResponse } from "next/server";
import { sendPush, type StoredSubscription } from "@/lib/server/push";
import { userClient } from "@/lib/server/supabase";

/** Send a test notification to the logged-in user's devices. */
export async function POST() {
  const supabase = await userClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "No device has notifications turned on." }, { status: 400 });
  }

  try {
    const outcome = await sendPush(subs as StoredSubscription[], {
      title: "360 Health test",
      body: "Notifications are working on this device.",
      url: "/settings",
      tag: "test",
    });
    if (outcome.expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", outcome.expiredIds);
    }
    return NextResponse.json(outcome);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
