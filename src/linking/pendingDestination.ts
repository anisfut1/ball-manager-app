/**
 * Destination d'origine mise de côté pendant la connexion : un parent qui
 * ouvre une convocation sans être connecté y arrive APRÈS la connexion
 * (jamais renvoyé systématiquement sur l'accueil). En mémoire seulement,
 * jamais un jeton ; effacée à la déconnexion.
 */
export interface PendingDestination {
  clubSlug: string | null;
  route: string;
}

let pending: PendingDestination | null = null;

const SAFE_ROUTE = /^\/[A-Za-z0-9/_?=&%.-]*$/;

export function setPendingDestination(value: PendingDestination | null): void {
  pending = value && SAFE_ROUTE.test(value.route) && !value.route.includes("..") && !value.route.startsWith("//") ? value : null;
}

export function peekPendingDestination(): PendingDestination | null {
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

/** Page d'une ressource précise (match, séance, dérogation…) : un lien qui y mène exprime une intention plus précise qu'une destination restée en attente. */
const RESOURCE_ROUTE = /^\/c\/[^/]+\/(matchs|derogations|entrainements|equipes|joueurs)\/[^/?]+/;

/**
 * Destination à retenir quand un lien personnel est ouvert : `existing` (mise de
 * côté avant la connexion) ou `incoming` (page d'atterrissage du lien).
 * L'email d'identification ramène sur une page par défaut du back : elle ne
 * doit pas remplacer la page que la personne voulait ouvrir (même club). Un
 * lien vers une ressource précise, lui, l'emporte toujours.
 */
export function mergeLinkDestination(existing: PendingDestination | null, incoming: PendingDestination | null): PendingDestination | null {
  if (!incoming) return existing;
  if (!existing || existing.clubSlug === null || existing.clubSlug !== incoming.clubSlug) return incoming;
  return RESOURCE_ROUTE.test(incoming.route) ? incoming : existing;
}
