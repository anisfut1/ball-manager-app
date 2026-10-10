import { api, auth, call } from "../client";
import type { Dto } from "../types";

export type TableRole = Dto<"TableAssignmentRole">;
export type TablesListDto = Dto<"PublicTableAssignmentsListDto">;
export type TableMatch = TablesListDto["matches"][number];
export type TableSuggestionsDto = Dto<"TableSuggestionsDto">;

/** Tables de marque (espace public) : suggestions expliquées, affectation MANUELLE, jamais automatique. */
export const tablesApi = {
  list: (clubSlug: string, as: string, from: string, to: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/table-assignments", { params: { path: { clubSlug }, query: { from, to } }, headers: auth(clubSlug, as) })),
  suggestions: (clubSlug: string, as: string, matchId: string, role: TableRole) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/matches/{matchId}/table-suggestions", { params: { path: { clubSlug, matchId }, query: { role } }, headers: auth(clubSlug, as) })),
  assign: (clubSlug: string, as: string, matchId: string, role: TableRole, licencieId: string, ignoreMatchConflict = false) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/matches/{matchId}/table-assignments/{role}", { params: { path: { clubSlug, matchId, role } }, headers: auth(clubSlug, as), body: { licencieId, ignoreMatchConflict } })),
  remove: (clubSlug: string, as: string, matchId: string, role: TableRole) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/matches/{matchId}/table-assignments/{role}", { params: { path: { clubSlug, matchId, role } }, headers: auth(clubSlug, as) })),
};

export const TABLE_ROLES: { role: TableRole; key: keyof TableMatch["assignments"]; label: string }[] = [
  { role: "SCORER", key: "scorer", label: "Marqueur" },
  { role: "TIMEKEEPER", key: "timekeeper", label: "Chronométreur" },
  { role: "CLUB_DELEGATE", key: "clubDelegate", label: "Délégué de club" },
  { role: "REFEREE", key: "referee", label: "Arbitre" },
];
