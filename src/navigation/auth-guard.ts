import { type SessionStatus } from "@/auth/session-machine";
import { type PendingDestination } from "@/linking/pendingDestination";

const KEPT_PARAMS = ["section", "tab"] as const;

export interface GuardInput {
  signedIn: boolean;
  status: SessionStatus;
  pathname: string;
  params: Record<string, string | string[] | undefined>;
}

export interface GuardDecision {
  /** Écran vers lequel renvoyer l'utilisateur. */
  redirect: string;
  /** Destination d'origine à mettre de côté pendant la connexion (null : rien à garder). */
  pending: PendingDestination | null;
}

/**
 * Garde d'authentification (UX seulement : la sécurité réelle est l'API).
 * Pas connecté : la destination demandée est mise de côté, puis connexion.
 * `null` = laisser passer.
 */
export function authGuard({ signedIn, status, pathname, params }: GuardInput): GuardDecision | null {
  if (signedIn) return null;
  const query = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const route = `${pathname}${query.toString() ? `?${query.toString()}` : ""}`;
  const clubSlug = /^\/c\/([a-z0-9-]+)/.exec(pathname)?.[1] ?? null;
  const redirect = status === "EXPIRED" ? "/session-expiree" : clubSlug ? `/connexion/${clubSlug}` : "/bienvenue";
  return { redirect, pending: route !== "/" ? { clubSlug, route } : null };
}
