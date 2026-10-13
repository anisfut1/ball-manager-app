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
  teamId?: string;
  limit?: number;
}

const path = (clubSlug: string) => ({ path: { clubSlug } });

export const clubSpaceApi = {
  home: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/home", { params: path(clubSlug), headers: auth(clubSlug, as) })),
  tableLeaderboard: (clubSlug: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}/table-leaderboard", { params: path(clubSlug) })),
  matches: (clubSlug: string, query: MatchesQuery) =>
    call(null, () => api().GET("/v1/public/clubs/{clubSlug}/matches", { params: { path: { clubSlug }, query } })).then((r) => r.matches),
  standings: (clubSlug: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}/standings", { params: path(clubSlug) })).then((r) => r.standings),
};
