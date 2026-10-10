import { ApiError } from "@/api/errors";
import type { DeviceMeta, DeviceSessionDto } from "@/api/endpoints/auth";
import type { Pkce } from "./pkce";
import { parseSsoCallback, SSO_CALLBACK, SsoCancelled } from "./callback";
import { withClub, withoutClub, withPeople, type ClubSession, type SessionPerson, type SessionState } from "./session-model";

/**
 * Services d'authentification — sans React, dépendances injectées (testés).
 * Trois entrées, une seule sortie : une session d'appareil dans le trousseau.
 *  1. lien personnel reçu (Universal Link `?token=`) → `bootstrapFromToken` ;
 *  2. lien de connexion à usage unique (`/connexion/code/{code}`) → `loginWithCode` ;
 *  3. « Continuer avec Ball Manager » (Safari + PKCE) → `ssoLogin`.
 */
export interface AuthApi {
  club(clubSlug: string): Promise<{ name: string; accentColor: string | null; timezone: string }>;
  createSession(clubSlug: string, tokens: string[], meta: DeviceMeta): Promise<DeviceSessionDto>;
  exchangeCode(clubSlug: string, code: string, codeVerifier: string | undefined, meta: DeviceMeta): Promise<DeviceSessionDto>;
  session(clubSlug: string, secret: string): Promise<{ people: SessionPerson[] }>;
  logout(clubSlug: string, secret: string): Promise<unknown>;
  addPeople(clubSlug: string, secret: string, tokens: string[]): Promise<{ people: SessionPerson[] }>;
  removePerson(clubSlug: string, secret: string, licencieId: string): Promise<unknown>;
}

export interface AuthDeps {
  api: AuthApi;
  meta: DeviceMeta;
  createPkce(): Promise<Pkce>;
  /** Ouvre ASWebAuthenticationSession ; renvoie l'URL de rappel, ou null si annulé. */
  openAuthSession(url: string, callback: string): Promise<string | null>;
  webUrl: string;
}

async function toClubSession(deps: AuthDeps, clubSlug: string, dto: DeviceSessionDto): Promise<ClubSession> {
  const club = await deps.api.club(clubSlug).catch(() => null);
  return {
    clubSlug,
    clubName: club?.name ?? clubSlug,
    accentColor: club?.accentColor ?? null,
    timezone: club?.timezone ?? "Europe/Paris",
    secret: dto.sessionSecret,
    people: dto.people,
    activeLicencieId: dto.people[0]?.licencieId ?? null,
  };
}

/** Lien personnel : déjà connecté à ce club → la personne est AJOUTÉE (ex. un autre enfant). */
export async function bootstrapFromToken(deps: AuthDeps, state: SessionState, clubSlug: string, token: string): Promise<SessionState> {
  const existing = state.clubs[clubSlug];
  if (existing) {
    const info = await deps.api.addPeople(clubSlug, existing.secret, [token]);
    const next = withPeople(state, clubSlug, info.people);
    return withClub(next, next.clubs[clubSlug]!);
  }
  return withClub(state, await toClubSession(deps, clubSlug, await deps.api.createSession(clubSlug, [token], deps.meta)));
}

export async function loginWithCode(deps: AuthDeps, state: SessionState, clubSlug: string, code: string): Promise<{ state: SessionState; redirectPath: string | null }> {
  const dto = await deps.api.exchangeCode(clubSlug, code, undefined, deps.meta);
  return { state: withClub(state, await toClubSession(deps, clubSlug, dto)), redirectPath: dto.redirectPath };
}

export function ssoUrl(webUrl: string, clubSlug: string, pkce: Pkce, redirectPath?: string | null): string {
  const query = new URLSearchParams({ code_challenge: pkce.challenge, code_challenge_method: "S256", state: pkce.state, redirect_uri: SSO_CALLBACK });
  if (redirectPath) query.set("redirect_path", redirectPath);
  return `${webUrl}/public/${encodeURIComponent(clubSlug)}/auth/app?${query.toString()}`;
}

/** Connexion Safari : annulation par l'utilisateur = `SsoCancelled` (jamais un message d'erreur). */
export async function ssoLogin(deps: AuthDeps, state: SessionState, clubSlug: string, redirectPath?: string | null): Promise<{ state: SessionState; redirectPath: string | null }> {
  const pkce = await deps.createPkce();
  const callbackUrl = await deps.openAuthSession(ssoUrl(deps.webUrl, clubSlug, pkce, redirectPath), SSO_CALLBACK);
  if (!callbackUrl) throw new SsoCancelled();
  const { code } = parseSsoCallback(callbackUrl, pkce.state);
  const dto = await deps.api.exchangeCode(clubSlug, code, pkce.verifier, deps.meta);
  return { state: withClub(state, await toClubSession(deps, clubSlug, dto)), redirectPath: dto.redirectPath };
}

/**
 * Revalide chaque session. 401 → club oublié sur l'appareil (lien réinitialisé,
 * expiration). Hors ligne / 5xx → session gardée (l'app reste utilisable).
 */
export async function refreshAll(deps: AuthDeps, state: SessionState): Promise<{ state: SessionState; expiredClubs: string[] }> {
  let next = state;
  const expiredClubs: string[] = [];
  for (const session of Object.values(state.clubs)) {
    try {
      const info = await deps.api.session(session.clubSlug, session.secret);
      next = withPeople(next, session.clubSlug, info.people);
      const club = await deps.api.club(session.clubSlug).catch(() => null);
      if (club && next.clubs[session.clubSlug]) {
        next = { ...next, clubs: { ...next.clubs, [session.clubSlug]: { ...next.clubs[session.clubSlug]!, clubName: club.name, accentColor: club.accentColor, timezone: club.timezone } } };
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        next = withoutClub(next, session.clubSlug);
        expiredClubs.push(session.clubSlug);
      }
    }
  }
  return { state: next, expiredClubs };
}

/** Déconnexion d'un club : `beforeRevoke` détache d'abord le jeton push (best effort). */
export async function logout(deps: AuthDeps, state: SessionState, clubSlug: string, beforeRevoke?: (session: ClubSession) => Promise<void>): Promise<SessionState> {
  const session = state.clubs[clubSlug];
  if (session) {
    await beforeRevoke?.(session).catch(() => undefined);
    await deps.api.logout(clubSlug, session.secret).catch(() => undefined);
  }
  return withoutClub(state, clubSlug);
}

export async function removePerson(deps: AuthDeps, state: SessionState, clubSlug: string, licencieId: string): Promise<SessionState> {
  const session = state.clubs[clubSlug];
  if (!session) return state;
  const people = session.people.filter((p) => p.licencieId !== licencieId);
  if (people.length === 0) return logout(deps, state, clubSlug);
  await deps.api.removePerson(clubSlug, session.secret, licencieId);
  return withPeople(state, clubSlug, people);
}
