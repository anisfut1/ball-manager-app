/**
 * Rappel de la connexion Safari (ASWebAuthenticationSession).
 * `fr.ballmanager.app://auth/callback` : c'est l'unique rappel accepté par la
 * page web `/public/{slug}/auth/app` (ball-manager-web, src/config/ios-app.ts).
 */
export const SSO_CALLBACK_SCHEME = "fr.ballmanager.app";
export const SSO_CALLBACK = `${SSO_CALLBACK_SCHEME}://auth/callback`;

export class SsoCancelled extends Error {
  constructor(reason = "cancelled") {
    super(reason);
    this.name = "SsoCancelled";
  }
}

export class SsoInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsoInvalid";
  }
}

/** Le `state` DOIT être celui envoyé, sinon la réponse est rejetée. */
export function parseSsoCallback(url: string, expectedState: string): { code: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsoInvalid("Rappel de connexion illisible.");
  }
  const base = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  if (base !== SSO_CALLBACK) throw new SsoInvalid("Rappel de connexion inattendu.");
  const params = parsed.searchParams;
  if (params.get("state") !== expectedState) throw new SsoInvalid("Réponse de connexion invalide (state).");
  const error = params.get("error");
  if (error) throw new SsoCancelled(error);
  const code = params.get("code");
  if (!code || !/^[A-Za-z0-9_-]{20,128}$/.test(code)) throw new SsoInvalid("Réponse de connexion invalide (code).");
  return { code };
}
