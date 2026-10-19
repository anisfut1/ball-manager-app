import { type SessionStatus } from "@/auth/session-machine";
import { type PendingDestination } from "@/linking/pendingDestination";

const KEPT_PARAMS = ["section", "tab"] as const;

export interface GuardInput {
  signedIn: boolean;
  status: SessionStatus;
  pathname: string;
  params: Record<string, string | string[] | undefined>;
  /** Club actif dont la session vient d'être refusée (voir `useSession().refusalRedirect`). */
  refusalRedirect?: string | null;
  /** Club choisi sur « Choisis ton club » (espace public, sans connexion). */
  browsingClub?: string | null;
}

export interface GuardDecision {
  /** Écran vers lequel renvoyer l'utilisateur. */
  redirect: string;
  /** Destination d'origine à mettre de côté pendant la connexion (null : rien à garder). */
  pending: PendingDestination | null;
}

/** Pages personnelles hors espace du club : elles demandent une identification. */
const PRIVATE_ROUTES = /^\/(planning|profil)(\/|$)/;

/**
 * Garde d'authentification (UX seulement : la sécurité réelle est l'API).
 * Comme /public/{club} sur le web, l'espace d'un club s'ouvre sans
 * connexion : les pages réservées y affichent elles-mêmes la porte « Accès
 * réservé aux licenciés ». Seules les pages personnelles (planning, profil)
 * renvoient vers l'identification, la destination étant mise de côté. Sans
 * club choisi : « Choisis ton club ». `null` = laisser passer.
 */
export function authGuard({ signedIn, status, pathname, params, refusalRedirect = null, browsingClub = null }: GuardInput): GuardDecision | null {
  if (signedIn) return null;
  const linkedClub = /^\/c\/([a-z0-9-]+)/.exec(pathname)?.[1] ?? null;
  if (linkedClub) return null;
  if (browsingClub && !PRIVATE_ROUTES.test(pathname)) return null;
  const query = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const route = `${pathname}${query.toString() ? `?${query.toString()}` : ""}`;
  const clubSlug = browsingClub;
  const redirect = status === "EXPIRED" && !refusalRedirect ? "/session-expiree" : refusalRedirect ? `/connexion/${refusalRedirect}` : clubSlug ? `/connexion/${clubSlug}` : "/bienvenue";
  return { redirect, pending: route !== "/" ? { clubSlug, route } : null };
}
