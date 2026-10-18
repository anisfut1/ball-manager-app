import type { SecretStorage } from "./secure-storage";

/**
 * Clubs dont la session a été refusée par le back (lien réinitialisé,
 * expiration…). Liste PURE et testée, persistée dans une clé SÉPARÉE de
 * `bm.sessions.v1` : jamais de secret ici, seulement le slug et le nom du club,
 * pour pouvoir dire à la personne quel club se reconnecter, même après un
 * redémarrage de l'app.
 */
export const REFUSED_CLUBS_KEY = "bm.refusedClubs.v1";

export interface RefusedClub {
  clubSlug: string;
  clubName: string;
}

export interface RefusalState {
  clubs: RefusedClub[];
}

export const NO_REFUSAL: RefusalState = { clubs: [] };

export type RefusalEvent =
  /** Liste relue du stockage au démarrage (fusionnée avec ce qui a pu être refusé entre-temps). */
  | { type: "LOADED"; clubs: RefusedClub[] }
  | { type: "REFUSED"; clubs: RefusedClub[] }
  /** Identification réussie sur ce club. */
  | { type: "SIGNED_IN"; clubSlug: string }
  /** Avis fermé par la personne. */
  | { type: "DISMISSED"; clubSlug: string };

const withoutSlug = (clubs: RefusedClub[], clubSlug: string) => clubs.filter((c) => c.clubSlug !== clubSlug);

/** Ajoute sans doublon (un club refusé deux fois n'apparaît qu'une fois) ; l'ordre d'arrivée est conservé. */
function merge(current: RefusedClub[], incoming: RefusedClub[]): RefusedClub[] {
  const known = new Set(current.map((c) => c.clubSlug));
  const added = incoming.filter((c, index) => !known.has(c.clubSlug) && incoming.findIndex((o) => o.clubSlug === c.clubSlug) === index);
  return added.length > 0 ? [...current, ...added] : current;
}

export function refusalReducer(state: RefusalState, event: RefusalEvent): RefusalState {
  switch (event.type) {
    case "LOADED":
      return { clubs: merge(event.clubs, state.clubs) };
    case "REFUSED":
      return { clubs: merge(state.clubs, event.clubs) };
    case "SIGNED_IN":
    case "DISMISSED":
      return { clubs: withoutSlug(state.clubs, event.clubSlug) };
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Données illisibles ou d'un autre format : liste vide (jamais un plantage au démarrage). */
export function parseRefusedClubs(raw: string | null): RefusedClub[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { v?: unknown; clubs?: unknown };
    if (data.v !== 1 || !Array.isArray(data.clubs)) return [];
    const clubs: RefusedClub[] = [];
    for (const entry of data.clubs as Partial<RefusedClub>[]) {
      if (typeof entry?.clubSlug === "string" && SLUG.test(entry.clubSlug) && typeof entry.clubName === "string") clubs.push({ clubSlug: entry.clubSlug, clubName: entry.clubName });
    }
    return merge([], clubs);
  } catch {
    return [];
  }
}

export function createRefusedClubsRepository(storage: SecretStorage) {
  return {
    async load(): Promise<RefusedClub[]> {
      try {
        return parseRefusedClubs(await storage.get(REFUSED_CLUBS_KEY));
      } catch {
        return [];
      }
    },
    async save(clubs: RefusedClub[]): Promise<void> {
      if (clubs.length === 0) await storage.remove(REFUSED_CLUBS_KEY);
      else await storage.set(REFUSED_CLUBS_KEY, JSON.stringify({ v: 1, clubs: clubs.map(({ clubSlug, clubName }) => ({ clubSlug, clubName })) }));
    },
  };
}
