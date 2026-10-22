import { z } from "zod";
import { ApiError } from "@/api/errors";
import type { SecretStorage } from "@/auth/secure-storage";

/**
 * Session d'ADMINISTRATION du club (2026-10-22) : compte du site,
 * `club_admin` de ce club, obtenu par `POST …/auth/admin-session` (le
 * serveur vérifie le mot de passe et le rôle). Gardée dans le Keychain, une
 * par club, séparée de la session d'appareil du licencié. Modèle PUR, testé.
 */
const AdminSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string(),
  clubId: z.string().min(1),
  email: z.string().nullable(),
});

export type AdminSession = z.infer<typeof AdminSessionSchema>;

/** Rafraîchi un peu avant l'expiration du jeton d'accès (1 h côté Supabase). */
export const REFRESH_MARGIN_MS = 2 * 60_000;

const keyFor = (clubSlug: string) => `bm.admin.${clubSlug}`;

export async function readAdminSession(storage: SecretStorage, clubSlug: string): Promise<AdminSession | null> {
  const raw = await storage.get(keyFor(clubSlug));
  if (!raw) return null;
  try {
    const parsed = AdminSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeAdminSession(storage: SecretStorage, clubSlug: string, session: AdminSession): Promise<void> {
  await storage.set(keyFor(clubSlug), JSON.stringify(AdminSessionSchema.parse(session)));
}

export async function clearAdminSession(storage: SecretStorage, clubSlug: string): Promise<void> {
  await storage.remove(keyFor(clubSlug));
}

export function needsRefresh(session: AdminSession, now: number): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt - now < REFRESH_MARGIN_MS;
}

/** Un seul rafraîchissement à la fois par club (plusieurs écrans peuvent demander en même temps). */
const inFlight = new Map<string, Promise<AdminSession | null>>();

/**
 * Session utilisable maintenant : rafraîchie si besoin. Rafraîchissement
 * refusé (session expirée, rôle retiré) : la session est effacée et `null`
 * est renvoyé — l'écran redemande la connexion. Coupure réseau : l'erreur
 * remonte, la session est gardée.
 */
export async function validAdminSession(
  storage: SecretStorage,
  clubSlug: string,
  refresh: (refreshToken: string) => Promise<AdminSession>,
  now: number = Date.now(),
): Promise<AdminSession | null> {
  const session = await readAdminSession(storage, clubSlug);
  if (!session || !needsRefresh(session, now)) return session;
  const pending = inFlight.get(clubSlug);
  if (pending) return pending;
  const run = (async () => {
    try {
      const next = await refresh(session.refreshToken);
      await writeAdminSession(storage, clubSlug, next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await clearAdminSession(storage, clubSlug);
        return null;
      }
      throw error;
    } finally {
      inFlight.delete(clubSlug);
    }
  })();
  inFlight.set(clubSlug, run);
  return run;
}
