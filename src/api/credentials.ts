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
