import { normalizeIncomingUrl } from "./normalizeIncomingUrl";
import { resolveLegacyPath, type Destination } from "./resolveLegacyPath";

/**
 * Point d'entrée UNIQUE : Universal Link, lien collé, schéma `ballmanager://`,
 * destination d'une notification push (chemin relatif). Pas deux logiques.
 */
export function resolveDestination(input: string): Destination {
  const normalized = normalizeIncomingUrl(input);
  if (!normalized.ok) return { kind: "reject", reason: normalized.reason };
  return resolveLegacyPath(normalized.url);
}

/** Chemin interne Expo Router pour une destination (utilisé par +native-intent). */
export function internalPathFor(destination: Destination): string | null {
  switch (destination.kind) {
    case "route":
      return destination.route;
    case "bootstrap":
      return `/lien?${new URLSearchParams({ club: destination.clubSlug, token: destination.token, next: destination.then }).toString()}`;
    case "login-code":
      return `/code?${new URLSearchParams({ club: destination.clubSlug, code: destination.code }).toString()}`;
    case "web-only":
      return `/web?${new URLSearchParams({ url: destination.url, reason: destination.reason }).toString()}`;
    case "home":
      return "/";
    case "reject":
      return null;
  }
}

/** Anti-doublon : au démarrage à froid, iOS peut livrer la même URL deux fois. */
export function createDeduper(windowMs = 3000, now: () => number = Date.now) {
  let last: { url: string; at: number } | null = null;
  return (url: string): boolean => {
    const t = now();
    if (last && last.url === url && t - last.at < windowMs) return false;
    last = { url, at: t };
    return true;
  };
}

export type { Destination };
