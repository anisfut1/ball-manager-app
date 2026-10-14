import { destinationAfterLogin } from "@/navigation/after-login";

/** Issue de « Continuer avec Ball Manager » : connecté, ou relayé par un lien reçu pendant la feuille. */
export type SsoOutcome = { kind: "signed-in"; redirectPath: string | null } | { kind: "superseded" };

/**
 * Écran de connexion : où aller après `ssoLogin`. `null` = ne rien faire
 * (la connexion par lien a déjà établi la session et navigue via `/lien` ou `/code`).
 */
export function routeAfterSso(outcome: SsoOutcome, clubSlug: string): string | null {
  return outcome.kind === "superseded" ? null : destinationAfterLogin(clubSlug, outcome.redirectPath);
}
