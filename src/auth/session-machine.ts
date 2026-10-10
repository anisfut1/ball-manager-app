import { hasClubs, type SessionState } from "./session-model";

/**
 * États de session de l'app (PUR, testé) :
 *  BOOTING        → lecture du trousseau (splash maintenu, pas de flash login → home)
 *  UNAUTHENTICATED→ aucun club sur cet appareil
 *  AUTHENTICATED  → au moins une session ; l'app s'ouvre tout de suite (hors ligne compris)
 *  REFRESHING     → sessions revalidées auprès de l'API, en arrière-plan
 *  EXPIRED        → toutes les sessions ont été refusées (lien réinitialisé, 180 j…)
 */
export type SessionStatus = "BOOTING" | "UNAUTHENTICATED" | "AUTHENTICATED" | "REFRESHING" | "EXPIRED";

export interface SessionMachine {
  status: SessionStatus;
  state: SessionState;
}

export type SessionEvent =
  | { type: "BOOTED"; state: SessionState }
  | { type: "REFRESH_STARTED" }
  | { type: "REFRESHED"; state: SessionState; expiredClubs: string[] }
  | { type: "SIGNED_IN"; state: SessionState }
  | { type: "UPDATED"; state: SessionState }
  | { type: "SIGNED_OUT"; state: SessionState }
  | { type: "SESSION_INVALID"; state: SessionState };

export function sessionReducer(current: SessionMachine, event: SessionEvent): SessionMachine {
  switch (event.type) {
    case "BOOTED":
      return { status: hasClubs(event.state) ? "AUTHENTICATED" : "UNAUTHENTICATED", state: event.state };
    case "REFRESH_STARTED":
      return current.status === "AUTHENTICATED" ? { ...current, status: "REFRESHING" } : current;
    case "REFRESHED":
      if (hasClubs(event.state)) return { status: "AUTHENTICATED", state: event.state };
      return { status: event.expiredClubs.length > 0 ? "EXPIRED" : "UNAUTHENTICATED", state: event.state };
    case "SIGNED_IN":
    case "UPDATED":
      return { status: hasClubs(event.state) ? (current.status === "REFRESHING" ? "REFRESHING" : "AUTHENTICATED") : "UNAUTHENTICATED", state: event.state };
    case "SIGNED_OUT":
      return { status: hasClubs(event.state) ? "AUTHENTICATED" : "UNAUTHENTICATED", state: event.state };
    case "SESSION_INVALID":
      return { status: hasClubs(event.state) ? "AUTHENTICATED" : "EXPIRED", state: event.state };
  }
}

export function isSignedIn(status: SessionStatus): boolean {
  return status === "AUTHENTICATED" || status === "REFRESHING";
}
