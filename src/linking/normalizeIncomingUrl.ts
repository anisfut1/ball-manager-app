import { APP_SCHEMES, isTrustedWebUrl } from "./validateDomain";

export interface NormalizedUrl {
  /** Chemin normalisé (décodé, sans doublons de `/`, sans `/` final). */
  path: string;
  segments: string[];
  query: URLSearchParams;
  /** Fragment sans `#`. */
  hash: string;
  /** Lien web (https) : d'où l'URL d'origine pour un repli dans Safari. */
  webOrigin: string | null;
}

export type NormalizeResult = { ok: true; url: NormalizedUrl } | { ok: false; reason: "invalid-domain" | "malformed" };

/** `null` si le chemin tente de sortir (`..`) ou n'est pas décodable. */
export function normalizePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((s) => s === ".." || s === ".")) return null;
  return `/${segments.join("/")}`;
}

/**
 * Accepte : URL https d'un domaine Ball Manager, URL du schéma de l'app
 * (`ballmanager://public/…`), chemin relatif (`/public/…`, destination push).
 * Une URL n'est JAMAIS une preuve de droit : elle dit seulement où aller.
 */
export function normalizeIncomingUrl(input: string): NormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "malformed" };
  let url: URL;
  try {
    url = raw.startsWith("/") ? new URL(raw, "https://www.ball-manager.fr") : new URL(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  let pathname = url.pathname;
  let webOrigin: string | null = null;
  if (!raw.startsWith("/")) {
    if (APP_SCHEMES.has(url.protocol)) {
      // ballmanager://public/x/accueil : l'hôte est le premier segment.
      pathname = `/${url.host}${url.pathname}`;
    } else if (isTrustedWebUrl(url)) {
      webOrigin = url.origin;
    } else {
      return { ok: false, reason: "invalid-domain" };
    }
  }
  const path = normalizePath(pathname);
  if (path === null) return { ok: false, reason: "malformed" };
  return { ok: true, url: { path, segments: path.split("/").filter(Boolean), query: new URLSearchParams(url.search), hash: url.hash.replace(/^#/, ""), webOrigin } };
}
