"use client";

import { useEffect, useState } from "react";
import { currentUserId, getSupabase } from "@/lib/supabase/client";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Status =
  | "checking"
  | "unsupported" // this browser cannot do push
  | "blocked" // the user denied permission in the browser
  | "off"
  | "on";

/** The push service wants the public key as raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentStatus(): Promise<Status> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/** Settings block: turn reminders on for this device, and send a test. */
export function NotificationsSection() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    currentStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await action() });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setStatus(await currentStatus().catch(() => "unsupported" as const));
      setBusy(false);
    }
  }

  const turnOn = () =>
    run(async () => {
      if (!PUBLIC_KEY) throw new Error("Push keys are not set up for this app yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed.");

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY),
        }));

      const json = subscription.toJSON();
      const user_id = await currentUserId();
      const { error } = await getSupabase()
        .from("push_subscriptions")
        .upsert(
          { user_id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          { onConflict: "endpoint" },
        );
      if (error) throw new Error(error.message);
      return "Reminders are on for this device.";
    });

  const turnOff = () =>
    run(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await getSupabase().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        if (error) throw new Error(error.message);
        await subscription.unsubscribe();
      }
      return "Reminders are off for this device.";
    });

  const sendTest = () =>
    run(async () => {
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The test could not be sent.");
      if (result.delivered === 0) throw new Error(result.errors?.[0] ?? "The push service did not accept the test.");
      return "Test sent. It should appear within a few seconds.";
    });

  return (
    <section>
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="mt-0.5 text-sm text-neutral-400">
        Check-in reminders on this device, even when the app is closed.
      </p>
      <div className="card mt-3 flex flex-col gap-3">
        {status === "checking" && <p className="text-neutral-500">Checking…</p>}
        {status === "unsupported" && (
          <p className="text-amber-200">
            This browser cannot receive notifications. On the phone, open the installed app from the home screen.
          </p>
        )}
        {status === "blocked" && (
          <p className="text-amber-200">
            Notifications are blocked for this app. Allow them in the phone’s settings for this app, then come back.
          </p>
        )}
        {status === "off" && (
          <button type="button" className="btn-primary" disabled={busy} onClick={turnOn}>
            {busy ? "Turning on…" : "Turn on reminders"}
          </button>
        )}
        {status === "on" && (
          <>
            <p className="text-emerald-400">Reminders are on for this device.</p>
            <button type="button" className="btn-primary" disabled={busy} onClick={sendTest}>
              {busy ? "Working…" : "Send test notification"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={turnOff}>
              Turn off on this device
            </button>
          </>
        )}
        {message && (
          <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
        )}
      </div>
    </section>
  );
}
