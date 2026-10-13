import { api, call } from "../client";
import type { Dto } from "../types";

/**
 * Authentification de l'app (protocole EXISTANT de ball-manager-back,
 * docs/MOBILE_AUTH.md) : aucune nouvelle route, aucun nouveau système.
 */
export type DeviceSessionDto = Dto<"DeviceSessionDto">;
export type SessionInfoDto = Dto<"SessionInfoDto">;
export type PublicClubDto = Dto<"PublicClubDto">;

const bearer = (secret: string) => ({ Authorization: `Bearer ${secret}` });

export interface DeviceMeta {
  appVersion?: string;
  deviceLabel?: string;
}

export const authApi = {
  listClubs: () => call(null, () => api().GET("/v1/public/clubs")),
  club: (clubSlug: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}", { params: { path: { clubSlug } } })),

  /** Lien personnel reçu (Universal Link `?token=`) → session d'appareil. Le jeton n'est pas conservé. */
  createSession: (clubSlug: string, tokens: string[], meta: DeviceMeta) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/auth/device-sessions", { params: { path: { clubSlug } }, body: { tokens, platform: "ios", ...meta } })),

  /** Code (lien de connexion à usage unique, ou SSO Safari + PKCE) → session d'appareil. */
  exchangeCode: (clubSlug: string, code: string, codeVerifier: string | undefined, meta: DeviceMeta) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/auth/token", { params: { path: { clubSlug } }, body: { code, codeVerifier, platform: "ios", ...meta } })) as Promise<DeviceSessionDto>,

  session: (clubSlug: string, secret: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/auth/session", { params: { path: { clubSlug } }, headers: bearer(secret) })),

  logout: (clubSlug: string, secret: string) => call(null, () => api().DELETE("/v1/public/clubs/{clubSlug}/auth/session", { params: { path: { clubSlug } }, headers: bearer(secret) })),

  /** Ajouter un enfant : son lien personnel le prouve. */
  addPeople: (clubSlug: string, secret: string, tokens: string[]) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/auth/session/people", { params: { path: { clubSlug } }, headers: bearer(secret), body: { tokens } })),

  removePerson: (clubSlug: string, secret: string, licencieId: string) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/auth/session/people/{licencieId}", { params: { path: { clubSlug, licencieId } }, headers: bearer(secret) })),

  registerPushToken: (clubSlug: string, secret: string, body: { token: string; environment: "development" | "production"; appVersion?: string }) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/auth/session/push-token", { params: { path: { clubSlug } }, headers: bearer(secret), body })),

  /** Notification de test vers CET iPhone seulement (jamais l'équipe). */
  pushTest: (clubSlug: string, secret: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/auth/session/push-test", { params: { path: { clubSlug } }, headers: bearer(secret) })),

  removePushToken: (clubSlug: string, secret: string) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/auth/session/push-token", { params: { path: { clubSlug } }, headers: bearer(secret) })),
};
