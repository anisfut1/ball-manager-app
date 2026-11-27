/**
 * Identifiants de requête de la session d'appareil, fournis par le
 * SessionProvider (une session par club). Le reste du code n'accède JAMAIS
 * au secret directement : seul le client API l'ajoute aux en-têtes.
 */
export interface CredentialSource {
  /** Secret `bmd_…` de la session de ce club (null si pas connecté à ce club). */
  secretFor(clubSlug: string): string | null;
  /** Une requête a reçu 401 SESSION_INVALID pour ce club. */
  onSessionInvalid(clubSlug: string): void;
  /** Compte : jeton d'accès rafraîchi s'il expire bientôt (null si pas de compte pour ce club ou échec). */
  freshSecretFor?(clubSlug: string): Promise<string | null>;
}

let source: CredentialSource | null = null;

export function setCredentialSource(next: CredentialSource | null): void {
  source = next;
}

export function credentialHeaders(clubSlug: string, actAs?: string | null): Record<string, string> {
  const secret = source?.secretFor(clubSlug) ?? null;
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;
  if (secret && actAs) headers["X-BM-As"] = actAs;
  return headers;
}

export function reportSessionInvalid(clubSlug: string): void {
  source?.onSessionInvalid(clubSlug);
}

/** Club d'une URL d'API publique (`/v1/public/clubs/{slug}/…`), sinon null. */
export function clubSlugOfUrl(url: string): string | null {
  const match = /\/v1\/public\/clubs\/([a-z0-9][a-z0-9-]{0,63})(?:\/|$|\?)/i.exec(url);
  return match ? match[1]!.toLowerCase() : null;
}

/**
 * Avant chaque requête vers un club : un jeton de COMPTE expiré ou presque est
 * rafraîchi, et l'en-tête remplacé. Les sessions d'appareil `bmd_…` ne sont
 * jamais touchées.
 */
export async function refreshAuthorization(request: Request): Promise<Request> {
  const header = request.headers.get("Authorization");
  if (!header || /^Bearer\s+bmd_/i.test(header) || !source?.freshSecretFor) return request;
  const slug = clubSlugOfUrl(request.url);
  if (!slug) return request;
  const fresh = await source.freshSecretFor(slug).catch(() => null);
  if (fresh && header !== `Bearer ${fresh}`) request.headers.set("Authorization", `Bearer ${fresh}`);
  return request;
}
