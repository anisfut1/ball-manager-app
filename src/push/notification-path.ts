/**
 * Destination d'une notification. Le backend (APNs direct) envoie
 * `{ aps: {…}, path: "/public/{slug}/…" }`. Sur iOS, expo-notifications range
 * le payload brut dans `request.trigger.payload` (et `content.data` ne
 * contient que la clé `body`, convention du service Expo) : on lit les deux.
 */
interface NotificationLike {
  request: {
    content: { data?: Record<string, unknown> | null };
    trigger: unknown;
  };
}

function pathIn(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const value = (record as Record<string, unknown>).path;
  return typeof value === "string" && value.startsWith("/public/") && value.length <= 300 ? value : null;
}

export function notificationPath(notification: NotificationLike): string | null {
  const trigger = notification.request.trigger;
  const payload = trigger && typeof trigger === "object" ? (trigger as { payload?: unknown }).payload : undefined;
  return (
    pathIn(payload) ??
    pathIn(notification.request.content.data) ??
    pathIn(payload && typeof payload === "object" ? (payload as Record<string, unknown>).body : undefined)
  );
}
