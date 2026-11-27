import { api, call } from "../client";
import { ApiError } from "../errors";
import type { Dto } from "../types";
import type { DeleteAccountResult } from "./auth";

/**
 * Comptes de l'espace licencié (email + mot de passe), mêmes routes que le
 * site — ball-manager-back/docs/ACCOUNTS.md. Aucun mot de passe n'est gardé
 * sur le téléphone : seulement les jetons, dans le trousseau.
 */
export type AccountSessionDto = Dto<"AccountSessionDto">;
export type AccountDto = Dto<"AccountDto">;
export type AccountPersonDto = Dto<"AccountPersonDto">;
export type AccountInviteDto = Dto<"AccountInviteDto">;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const path = (clubSlug: string) => ({ params: { path: { clubSlug } } });

export const accountApi = {
  signUp: (email: string, password: string) => call(null, () => api().POST("/v1/account/sign-up", { body: { email, password } })),
  resendCode: (email: string) => call(null, () => api().POST("/v1/account/sign-up/resend", { body: { email } })),
  verify: (email: string, code: string, password: string) => call(null, () => api().POST("/v1/account/sign-up/verify", { body: { email, code, password } })) as Promise<AccountSessionDto>,
  signIn: (email: string, password: string) => call(null, () => api().POST("/v1/account/sign-in", { body: { email, password } })) as Promise<AccountSessionDto>,
  refresh: (refreshToken: string) => call(null, () => api().POST("/v1/account/refresh", { body: { refreshToken } })) as Promise<AccountSessionDto>,
  passwordReset: (email: string) => call(null, () => api().POST("/v1/account/password-reset", { body: { email } })),

  get: (clubSlug: string, accessToken: string) => call(null, () => api().GET("/v1/public/clubs/{clubSlug}/account", { ...path(clubSlug), headers: bearer(accessToken) })) as Promise<AccountDto>,
  link: (clubSlug: string, accessToken: string, licencieId: string) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/account/links", { ...path(clubSlug), headers: bearer(accessToken), body: { licencieId } })),
  /** Reprise des personnes d'une session d'appareil `bmd_…` (app d'avant les comptes). */
  importDeviceSession: (clubSlug: string, accessToken: string, sessionSecret: string) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/account/links/device-session", { ...path(clubSlug), headers: bearer(accessToken), body: { sessionSecret } })) as Promise<AccountDto>,
  unlink: (clubSlug: string, accessToken: string, licencieId: string) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/account/links/{licencieId}", { params: { path: { clubSlug, licencieId } }, headers: bearer(accessToken) })),
  invite: (clubSlug: string, accessToken: string, licencieId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/account/invites", { ...path(clubSlug), headers: bearer(accessToken), body: { licencieId } })) as Promise<AccountInviteDto>,
  acceptInvite: (clubSlug: string, accessToken: string, code: string) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/account/invites/accept", { ...path(clubSlug), headers: bearer(accessToken), body: { code } })) as Promise<AccountDto>,

  registerPushToken: (clubSlug: string, accessToken: string, body: { token: string; environment: "development" | "production"; appVersion?: string }) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/account/push-token", { ...path(clubSlug), headers: bearer(accessToken), body })),
  removePushToken: (clubSlug: string, accessToken: string, token: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/account/push-token/remove", { ...path(clubSlug), headers: bearer(accessToken), body: { token } })),
  pushTest: (clubSlug: string, accessToken: string, token: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/account/push-test", { ...path(clubSlug), headers: bearer(accessToken), body: { token } })),

  /** Suppression du compte (guideline Apple 5.1.1(v)) : même contrat que la suppression par session d'appareil. */
  deleteAccount: async (clubSlug: string, accessToken: string): Promise<DeleteAccountResult> => {
    try {
      await call(null, () => api().DELETE("/v1/public/clubs/{clubSlug}/account", { ...path(clubSlug), headers: bearer(accessToken) }));
      return { kind: "deleted" };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return error.status === 401 ? { kind: "session_invalid" } : { kind: "failed", error };
    }
  },
};
