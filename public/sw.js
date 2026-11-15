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
  event.waitUntil(
    self.registration.showNotification(data.title || "360 Health", {
      body: data.body || "",
      // Same tag = a newer reminder of the same kind replaces the older one.
      tag: data.tag || "reminder",
      icon: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // If the app is already open, bring it forward on the right screen.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          if ("navigate" in client) await client.navigate(target);
        } catch {
          // Not navigable from here; focusing the window is still useful.
        }
        return client.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
