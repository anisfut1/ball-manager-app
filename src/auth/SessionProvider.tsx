import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { setCredentialSource } from "@/api/credentials";
import { env } from "@/config/env";
import { clearPendingDestination } from "@/linking/pendingDestination";
import { detachPush } from "@/push/registration";
import * as service from "./auth-service";
import { createPkce } from "./pkce";
import { activeClub, activePerson, EMPTY_STATE, withActiveClub, withActivePerson, withoutClub, type ClubSession, type SessionPerson, type SessionState } from "./session-model";
import { createSessionRepository } from "./session-repository";
import type { SsoOutcome } from "./sso-outcome";
import { isSignedIn, sessionReducer, type SessionStatus } from "./session-machine";
import { secureStorage } from "./secure-storage";

const repository = createSessionRepository(secureStorage);

const deps: service.AuthDeps = {
  api: authApi,
  meta: { appVersion: Application.nativeApplicationVersion ?? undefined, deviceLabel: "iPhone" },
  createPkce: () => createPkce(),
  openAuthSession: async (url, callback) => {
    // Partage les cookies de Safari (déjà connecté sur le site → un geste).
    const result = await WebBrowser.openAuthSessionAsync(url, callback, { preferEphemeralSession: false });
    return result.type === "success" ? result.url : null;
  },
  dismissAuthSession: () => WebBrowser.dismissAuthSession(),
  webUrl: env.webUrl,
};

export interface SessionContextValue {
  status: SessionStatus;
  signedIn: boolean;
  state: SessionState;
  club: ClubSession | null;
  person: SessionPerson | null;
  bootstrapFromToken(clubSlug: string, token: string): Promise<void>;
  loginWithCode(clubSlug: string, code: string): Promise<string | null>;
  ssoLogin(clubSlug: string, redirectPath?: string | null): Promise<SsoOutcome>;
  logout(clubSlug: string): Promise<void>;
  removePerson(clubSlug: string, licencieId: string): Promise<void>;
  setActivePerson(licencieId: string): Promise<void>;
  setActiveClub(clubSlug: string): Promise<void>;
  refresh(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Au lancement : trousseau → restauration → app (immédiat, hors ligne
 * compris) → revalidation en arrière-plan. Pas de flash login → home → login :
 * le splash reste affiché tant que l'état est BOOTING.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [machine, dispatch] = useReducer(sessionReducer, { status: "BOOTING", state: EMPTY_STATE });
  // Source de vérité synchrone pour les actions : chaque changement d'état passe
  // par `persist` (ou l'amorçage) AVANT le dispatch, le ref est donc toujours à jour.
  const stateRef = useRef<SessionState>(EMPTY_STATE);

  const persist = useCallback(async (next: SessionState) => {
    stateRef.current = next;
    await repository.save(next);
  }, []);

  const refresh = useCallback(async () => {
    dispatch({ type: "REFRESH_STARTED" });
    const { state, expiredClubs } = await service.refreshAll(deps, stateRef.current);
    await persist(state);
    for (const slug of expiredClubs) queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(slug) });
    dispatch({ type: "REFRESHED", state, expiredClubs });
  }, [persist, queryClient]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const state = await repository.load();
      if (!alive) return;
      stateRef.current = state;
      dispatch({ type: "BOOTED", state });
      if (Object.keys(state.clubs).length > 0) await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // Le client API lit le secret ici ; un 401 « session invalide » retire le club.
  useEffect(() => {
    setCredentialSource({
      secretFor: (slug) => stateRef.current.clubs[slug]?.secret ?? null,
      onSessionInvalid: (slug) => {
        if (!stateRef.current.clubs[slug]) return;
        const next = withoutClub(stateRef.current, slug);
        void persist(next);
        queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(slug) });
        dispatch({ type: "SESSION_INVALID", state: next });
      },
    });
    return () => setCredentialSource(null);
  }, [persist, queryClient]);

  const signIn = useCallback(
    async (next: SessionState) => {
      await persist(next);
      dispatch({ type: "SIGNED_IN", state: next });
    },
    [persist],
  );

  const value = useMemo<SessionContextValue>(() => {
    const club = activeClub(machine.state);
    return {
      status: machine.status,
      signedIn: isSignedIn(machine.status),
      state: machine.state,
      club,
      person: club ? activePerson(club) : null,
      refresh,
      async bootstrapFromToken(clubSlug, token) {
        await signIn(await service.bootstrapFromToken(deps, stateRef.current, clubSlug, token));
      },
      async loginWithCode(clubSlug, code) {
        const result = await service.loginWithCode(deps, stateRef.current, clubSlug, code);
        await signIn(result.state);
        return result.redirectPath;
      },
      async ssoLogin(clubSlug, redirectPath) {
        const result = await service.ssoLogin(deps, stateRef.current, clubSlug, redirectPath);
        // Relayé par un lien (feuille fermée) : la session est déjà établie par /lien ou /code.
        if (result.kind === "superseded") return { kind: "superseded" };
        await signIn(result.state);
        return { kind: "signed-in", redirectPath: result.redirectPath };
      },
      async logout(clubSlug) {
        // 1. jeton push détaché, 2. session révoquée, 3. trousseau, 4. cache, 5. destination en attente.
        const next = await service.logout(deps, stateRef.current, clubSlug, detachPush);
        await persist(next);
        queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(clubSlug) });
        if (Object.keys(next.clubs).length === 0) {
          queryClient.clear();
          clearPendingDestination();
        }
        dispatch({ type: "SIGNED_OUT", state: next });
      },
      async removePerson(clubSlug, licencieId) {
        const next = await service.removePerson(deps, stateRef.current, clubSlug, licencieId);
        await persist(next);
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes(clubSlug) });
        dispatch({ type: next.clubs[clubSlug] ? "UPDATED" : "SIGNED_OUT", state: next });
      },
      async setActivePerson(licencieId) {
        const current = activeClub(stateRef.current);
        if (!current) return;
        const next = withActivePerson(stateRef.current, current.clubSlug, licencieId);
        await persist(next);
        dispatch({ type: "UPDATED", state: next });
      },
      async setActiveClub(clubSlug) {
        if (stateRef.current.active === clubSlug) return;
        const next = withActiveClub(stateRef.current, clubSlug);
        await persist(next);
        dispatch({ type: "UPDATED", state: next });
      },
    };
  }, [machine, persist, queryClient, refresh, signIn]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession hors de SessionProvider");
  return value;
}

/** Club actif garanti (écrans sous le garde d'authentification). */
export function useActiveClub(): ClubSession {
  const { club } = useSession();
  if (!club) throw new Error("Aucun club actif");
  return club;
}
