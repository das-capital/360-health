// Service worker: shows reminders that arrive by Web Push, even when the app
// is closed, and opens the right screen when one is tapped. No offline caching.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "360 Health";
  const tag = data.tag || "reminder";
  const options = {
    body: data.body || "",
    // Same tag = a newer reminder of the same kind replaces the older one.
    tag,
    icon: "/icon-192.png",
    data: { url: data.url || "/", title, tag },
  };
  // Yesterday's mobility can be answered straight from the notification.
  if (data.mobility && data.mobility.date) {
    options.data.mobility = data.mobility;
    options.actions = [
      { action: "mobility-yes", title: "Mobility: Yes" },
      { action: "mobility-no", title: "Mobility: No" },
    ];
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if ((event.action === "mobility-yes" || event.action === "mobility-no") && data.mobility) {
    event.waitUntil(answerMobility(data, event.action === "mobility-yes"));
    return;
  }

  event.waitUntil(openApp(data.url || "/"));
});

// Save the mobility answer without opening the app. If that fails (for
// example, logged out), open the Mobility screen instead.
async function answerMobility(data, done) {
  let saved = false;
  try {
    const response = await fetch("/api/mobility", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: data.mobility.date, done }),
    });
    saved = response.ok && (await response.json()).saved === true;
  } catch {
    saved = false;
  }
  if (!saved) {
    await openApp("/mobility");
    return;
  }
  // Anything else still to log? Show the reminder again without the mobility part.
  if (data.mobility.rest) {
    await self.registration.showNotification(data.title || "360 Health", {
      body: data.mobility.rest,
      tag: data.tag || "reminder",
      icon: "/icon-192.png",
      data: { url: data.url || "/", title: data.title, tag: data.tag },
    });
  }
}

async function openApp(path) {
  const target = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((client) => new URL(client.url).origin === self.location.origin);

  if (open) {
    try {
      // Bring the app forward FIRST. The phone only allows this for a brief
      // moment after the tap, so nothing slow may come before it.
      const focused = await open.focus();
      // Then move it to the right screen, without letting a stuck page hold things up.
      const client = focused || open;
      if ("navigate" in client) {
        await Promise.race([
          client.navigate(target).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
      return;
    } catch {
      // Could not bring that window forward; open a fresh one instead.
    }
  }
  await self.clients.openWindow(target);
}
