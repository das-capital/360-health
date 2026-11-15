import "server-only";
import * as webpush from "web-push";

export type PushMessage = {
  title: string;
  body: string;
  /** Screen to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag: string;
};

export type StoredSubscription = { id: number; endpoint: string; p256dh: string; auth: string };

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Push keys are not set on the server.");
  // Push services want a contact address for the sender; the app's own address is used.
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  webpush.setVapidDetails(host ? `https://${host}` : "https://localhost", publicKey, privateKey);
  configured = true;
}

export type PushOutcome = {
  delivered: number;
  /** Subscriptions the push service says no longer exist; they should be deleted. */
  expiredIds: number[];
  errors: string[];
};

/** Send one message to every device subscription given. */
export async function sendPush(subscriptions: StoredSubscription[], message: PushMessage): Promise<PushOutcome> {
  configure();
  const outcome: PushOutcome = { delivered: 0, expiredIds: [], errors: [] };

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          // Deliver promptly; give up after an hour, since a late reminder is noise.
          { TTL: 3600, urgency: "high" },
        );
        outcome.delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) outcome.expiredIds.push(sub.id);
        else outcome.errors.push(`Push service answered ${status ?? "with an error"}`);
      }
    }),
  );
  return outcome;
}
