import { internalPathFor, resolveDestination } from "@/linking/resolveDestination";

/**
 * Toute URL entrante (Universal Link https://www.ball-manager.fr/…, schéma
 * ballmanager://…) passe par le résolveur UNIQUE avant Expo Router. Les
 * anciens liens web restent valides ; un domaine étranger est ignoré.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return internalPathFor(resolveDestination(path)) ?? "/";
  } catch {
    return "/";
  }
}
