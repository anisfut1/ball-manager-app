/**
 * Configuration PUBLIQUE de l'app (tout bundle mobile est public) :
 * uniquement des URL. Aucun secret ici (pas de clé Supabase, APNs, Resend…).
 */
const DEFAULT_WEB_URL = "https://www.ball-manager.fr";

function cleanUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export const env = {
  /** URL de ball-manager-back (EAS : variable EXPO_PUBLIC_API_URL du profil). */
  apiUrl: cleanUrl(process.env.EXPO_PUBLIC_API_URL),
  /** Site ball-manager-web (connexion Safari, pages légales, liens « Ouvrir sur le site »). */
  webUrl: cleanUrl(process.env.EXPO_PUBLIC_WEB_URL) ?? DEFAULT_WEB_URL,
} as const;

/** Configuration du bundle incomplète : à distinguer d'une coupure réseau. */
export class MissingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingConfigError";
  }
}

export function requireApiUrl(): string {
  if (!env.apiUrl) throw new MissingConfigError("EXPO_PUBLIC_API_URL manquant : URL de ball-manager-back.");
  return env.apiUrl;
}
