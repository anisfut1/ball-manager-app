import { internalPathFor, resolveDestination } from "@/linking/resolveDestination";
import { takePendingDestination } from "@/linking/pendingDestination";

/**
 * Où aller après une connexion : la destination d'origine (convocation
 * ouverte avant d'être connecté), sinon celle renvoyée par l'API (chemin web
 * du lien de connexion), sinon l'accueil du club. Jamais l'accueil par défaut
 * quand une destination existe.
 */
export function destinationAfterLogin(clubSlug: string, redirectPath: string | null): string {
  const pending = takePendingDestination(clubSlug);
  if (pending) return pending;
  if (redirectPath) {
    const path = internalPathFor(resolveDestination(redirectPath));
    if (path && path !== "/") return path;
  }
  return `/c/${clubSlug}`;
}
