import { adminLongApi, api, call } from "../client";
import { credentialHeaders } from "../credentials";
import { ApiError } from "../errors";
import type { Dto } from "../types";
import { secureStorage } from "@/auth/secure-storage";
import { clearAdminSession, validAdminSession, writeAdminSession, type AdminSession } from "@/features/admin/admin-session";

/**
 * Administration du club (2026-10-22) : mêmes routes `/v1/clubs/{clubId}/…`
 * que le site, avec la session du COMPTE admin (Bearer). La connexion passe
 * par `…/auth/admin-session` avec la session d'appareil du club : le
 * serveur vérifie le mot de passe et le rôle `club_admin`.
 */
export type ClubVenueAdminDto = Dto<"ClubVenueAdminDto">;
export type VenueClosureDto = Dto<"VenueClosureDto">;
export type VenueClosurePeriod = Dto<"VenueClosurePeriod">;
export type CreateVenueClosureDto = Dto<"CreateVenueClosureDto">;
export type IssueDto = Dto<"IssueDto">;
export type TeamDto = Dto<"TeamDto">;
export type CreateTeamDto = Dto<"CreateTeamDto">;
export type UpdateTeamDto = Dto<"UpdateTeamDto">;
export type MatchListItemDto = Dto<"MatchListItemDto">;
export type IntegrationStatusDto = Dto<"IntegrationStatusDto">;
export type SyncRunDto = Dto<"SyncRunDto">;
export type ClubDto = Dto<"ClubDto">;
export type UpdateClubDto = Dto<"UpdateClubDto">;

/** Plus de session admin utilisable : l'écran redemande la connexion. */
export class AdminSessionRequiredError extends Error {
  constructor() {
    super("Connexion administrateur requise.");
    this.name = "AdminSessionRequiredError";
  }
}

type Listener = (clubSlug: string) => void;
const listeners = new Set<Listener>();

/** Prévenu à chaque connexion / déconnexion / expiration de la session admin d'un club. */
export function onAdminSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(clubSlug: string): void {
  listeners.forEach((listener) => listener(clubSlug));
}

const authPath = (clubSlug: string) => ({ params: { path: { clubSlug } }, headers: credentialHeaders(clubSlug) });

export const adminAuthApi = {
  login: (clubSlug: string, email: string, password: string) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/auth/admin-session", { ...authPath(clubSlug), body: { email, password } })) as Promise<AdminSession>,
  refresh: (clubSlug: string, refreshToken: string) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/auth/admin-session/refresh", { ...authPath(clubSlug), body: { refreshToken } })) as Promise<AdminSession>,
};

export async function adminSignIn(clubSlug: string, email: string, password: string): Promise<AdminSession> {
  const session = await adminAuthApi.login(clubSlug, email.trim(), password);
  await writeAdminSession(secureStorage, clubSlug, session);
  changed(clubSlug);
  return session;
}

export async function adminSignOut(clubSlug: string): Promise<void> {
  await clearAdminSession(secureStorage, clubSlug);
  changed(clubSlug);
}

/** Session admin utilisable maintenant (rafraîchie si besoin), ou null. */
export function currentAdminSession(clubSlug: string): Promise<AdminSession | null> {
  return validAdminSession(secureStorage, clubSlug, (refreshToken) => adminAuthApi.refresh(clubSlug, refreshToken));
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Appel admin : jeton du compte ajouté ; 401 → session effacée et reconnexion demandée. */
async function adminCall<T>(clubSlug: string, run: (clubId: string, headers: Record<string, string>) => Promise<FetchResult<T>>): Promise<T> {
  const session = await currentAdminSession(clubSlug);
  if (!session) {
    changed(clubSlug);
    throw new AdminSessionRequiredError();
  }
  try {
    return await call(null, () => run(session.clubId, { Authorization: `Bearer ${session.accessToken}` }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await adminSignOut(clubSlug);
      throw new AdminSessionRequiredError();
    }
    throw error;
  }
}

const club = (clubId: string) => ({ path: { clubId } });

const MATCH_PAGE = 200;

export const adminApi = {
  venues: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/venues", { params: club(clubId), headers })).then((r) => r.venues),
  updateVenue: (slug: string, venueId: string, body: { active?: boolean; name?: string }) =>
    adminCall(slug, (clubId, headers) => api().PATCH("/v1/clubs/{clubId}/venues/{venueId}", { params: { path: { clubId, venueId } }, headers, body })).then((r) => r.venue),
  closures: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/venues/closures", { params: club(clubId), headers })).then((r) => r.closures),
  createClosure: (slug: string, body: CreateVenueClosureDto) =>
    adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/venues/closures", { params: club(clubId), headers, body })).then((r) => r.closure),
  deleteClosure: (slug: string, closureId: string) =>
    adminCall(slug, (clubId, headers) => api().DELETE("/v1/clubs/{clubId}/venues/closures/{closureId}", { params: { path: { clubId, closureId } }, headers })),
  issues: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/issues", { params: club(clubId), headers })).then((r) => r.issues),
  dismissIssue: (slug: string, key: string) => adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/issues/dismiss", { params: club(clubId), headers, body: { key } })),
  teams: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/teams", { params: club(clubId), headers })).then((r) => r.teams),
  createTeam: (slug: string, body: CreateTeamDto) => adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/teams", { params: club(clubId), headers, body })),
  updateTeam: (slug: string, teamId: string, body: UpdateTeamDto) =>
    adminCall(slug, (clubId, headers) => api().PATCH("/v1/clubs/{clubId}/teams/{teamId}", { params: { path: { clubId, teamId } }, headers, body })),
  club: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}", { params: club(clubId), headers })),
  updateClub: (slug: string, body: UpdateClubDto) => adminCall(slug, (clubId, headers) => api().PATCH("/v1/clubs/{clubId}", { params: club(clubId), headers, body })),
  capabilities: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/capabilities", { params: club(clubId), headers })),
  integrations: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/integrations", { params: club(clubId), headers })),
  syncRuns: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/integrations/sync-runs", { params: club(clubId), headers })).then((r) => r.syncRuns),
  triggerFfbbSync: (slug: string) => adminCall(slug, (clubId, headers) => adminLongApi().POST("/v1/clubs/{clubId}/integrations/ffbb/sync", { params: club(clubId), headers })),
  saveFbiCredentials: (slug: string, body: { username: string; password?: string }) =>
    adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/integrations/fbi", { params: club(clubId), headers, body })),
  testFbi: (slug: string) => adminCall(slug, (clubId, headers) => adminLongApi().POST("/v1/clubs/{clubId}/integrations/fbi/test", { params: club(clubId), headers })),
  processFbiJobs: (slug: string) => adminCall(slug, (clubId, headers) => adminLongApi().POST("/v1/clubs/{clubId}/integrations/fbi/process-jobs", { params: club(clubId), headers })),
  parseFbiDocuments: (slug: string) => adminCall(slug, (clubId, headers) => adminLongApi().POST("/v1/clubs/{clubId}/integrations/fbi/parse-documents", { params: club(clubId), headers })),
  reconcileFbiSchedule: (slug: string) => adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/integrations/fbi/reconcile-schedule", { params: club(clubId), headers })),
  checkAllDerogations: (slug: string) => adminCall(slug, (clubId, headers) => adminLongApi().POST("/v1/clubs/{clubId}/integrations/fbi/check-all-derogations", { params: club(clubId), headers })),
  emarqueTracking: (slug: string) => adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/emarque-tracking", { params: club(clubId), headers })).then((r) => r.matches),
  relaunchEmarque: (slug: string, matchId: string) =>
    adminCall(slug, (clubId, headers) => api().POST("/v1/clubs/{clubId}/emarque-tracking/{matchId}/relaunch", { params: { path: { clubId, matchId } }, headers })),
  /** Tous les matchs d'une période (pages de 200, comme le site). */
  matches: async (slug: string, range: { from: string; to?: string }): Promise<MatchListItemDto[]> => {
    const all: MatchListItemDto[] = [];
    for (let offset = 0; ; offset += MATCH_PAGE) {
      const page = await adminCall(slug, (clubId, headers) => api().GET("/v1/clubs/{clubId}/matches", { params: { path: { clubId }, query: { ...range, limit: MATCH_PAGE, offset } }, headers }));
      all.push(...page.matches);
      if (page.matches.length < MATCH_PAGE) return all;
    }
  },
};
