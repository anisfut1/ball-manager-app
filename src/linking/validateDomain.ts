/** Domaines Ball Manager acceptés pour un lien entrant (HTTPS uniquement). */
export const LINK_HOSTS: ReadonlySet<string> = new Set(["www.ball-manager.fr", "ball-manager.fr", "open.ball-manager.fr"]);

/** Schémas de l'app (`ballmanager://…`, et le schéma historique du rappel SSO). */
export const APP_SCHEMES: ReadonlySet<string> = new Set(["ballmanager:", "fr.ballmanager.app:"]);

export const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ID = /^[A-Za-z0-9-]{1,64}$/;

export function isTrustedWebUrl(url: URL): boolean {
  return url.protocol === "https:" && LINK_HOSTS.has(url.hostname);
}
