import { api, auth, call } from "../client";
import type { Dto } from "../types";

/**
 * Espace du club, mêmes sources que les pages publiques de ball-manager-web
 * (accueil, matchs, résultats, classements). `/home` est personnel : il
 * demande la session d'appareil et la personne active (X-BM-As).
 */
export type PublicHomeDto = Dto<"PublicHomeDto">;
export type HomeRelation = Dto<"HomeRelation">;
export type MatchListItem = Dto<"MatchListItemDto">;
export type TableLeaderboardDto = Dto<"TableLeaderboardDto">;
export type PoolStandingsDto = Dto<"PoolStandingsDto">;

export interface MatchesQuery {
  period?: "weekend" | "upcoming" | "past";
  from?: string;
  to?: string;
  teamId?: string;
  homeAway?: "home" | "away";
  limit?: number;
  offset?: number;
}

/** Comme le web (listPublicMatches) : pages de 200, jusqu'à épuisement, 25 pages au plus. */
const PAGE = 200;
const MAX_PAGES = 25;

const path = (clubSlug: string) => ({ path: { clubSlug } });

export const clubSpaceApi = {
  home: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/home", { params: path(clubSlug), headers: auth(clubSlug, as) })),
  tableLeaderboard: (clubSlug: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}/table-leaderboard", { params: path(clubSlug) })),
  matches: (clubSlug: string, query: MatchesQuery) =>
    call(null, () => api().GET("/v1/public/clubs/{clubSlug}/matches", { params: { path: { clubSlug }, query } })).then((r) => r.matches),
  /** Tous les matchs d'une fenêtre (paginés jusqu'au bout : jamais de saison tronquée). */
  allMatches: async (clubSlug: string, query: Omit<MatchesQuery, "limit" | "offset">): Promise<MatchListItem[]> => {
    const out: MatchListItem[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE;
      const r = await call(null, () => api().GET("/v1/public/clubs/{clubSlug}/matches", { params: { path: { clubSlug }, query: { ...query, limit: PAGE, offset } } }));
      out.push(...r.matches);
      if (r.matches.length < PAGE || offset + PAGE >= r.pagination.total) break;
    }
    return out;
  },
  standings: (clubSlug: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}/standings", { params: path(clubSlug) })).then((r) => r.standings),
};
