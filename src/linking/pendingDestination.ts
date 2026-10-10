/**
 * Destination d'origine mise de côté pendant la connexion : un parent qui
 * ouvre une convocation sans être connecté y arrive APRÈS la connexion
 * (jamais renvoyé systématiquement sur l'accueil). En mémoire seulement,
 * jamais un jeton ; effacée à la déconnexion.
 */
let pending: { clubSlug: string | null; route: string } | null = null;

const SAFE_ROUTE = /^\/[A-Za-z0-9/_?=&%.-]*$/;

export function setPendingDestination(value: { clubSlug: string | null; route: string } | null): void {
  pending = value && SAFE_ROUTE.test(value.route) && !value.route.includes("..") && !value.route.startsWith("//") ? value : null;
}

export function peekPendingDestination(): { clubSlug: string | null; route: string } | null {
  return pending;
}

/** Consommée une seule fois ; `clubSlug` : seulement si elle concerne ce club (ou n'importe lequel). */
export function takePendingDestination(clubSlug?: string): string | null {
  if (!pending) return null;
  if (clubSlug && pending.clubSlug && pending.clubSlug !== clubSlug) return null;
  const route = pending.route;
  pending = null;
  return route;
}

export function clearPendingDestination(): void {
  pending = null;
}
