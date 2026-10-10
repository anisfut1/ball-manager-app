import { api, auth, call } from "../client";
import type { Dto } from "../types";

export type DerogationContextDto = Dto<"DerogationContextDto">;
export type DerogationSummary = Dto<"DerogationRequestSummaryDto">;
export type DerogationDetail = Dto<"DerogationRequestDetailDto">;
export type DerogationAction = Dto<"DerogationAction">;
export type DerogationStatus = Dto<"DerogationRequestStatus">;

/**
 * Demandes de dérogation INTERNES au club (coach → coordinateur). Jamais
 * d'écriture automatique dans FFBB/FBI : la saisie officielle reste sur le site.
 */
export const derogationsApi = {
  context: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/context", { params: { path: { clubSlug } }, headers: auth(clubSlug, as) })),
  list: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests", { params: { path: { clubSlug }, query: { limit: 50 } }, headers: auth(clubSlug, as) })),
  detail: (clubSlug: string, as: string, requestId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}", { params: { path: { clubSlug, requestId } }, headers: auth(clubSlug, as) })),
  create: (clubSlug: string, as: string, body: Dto<"CreateDerogationRequestDto">) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests", { params: { path: { clubSlug } }, headers: auth(clubSlug, as), body })),
  message: (clubSlug: string, as: string, requestId: string, message: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/messages", { params: { path: { clubSlug, requestId } }, headers: auth(clubSlug, as), body: { message } })),
  action: (clubSlug: string, as: string, requestId: string, action: DerogationAction, message?: string | null) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/actions", { params: { path: { clubSlug, requestId } }, headers: auth(clubSlug, as), body: { action, message: message || null } })),
  propose: (clubSlug: string, as: string, requestId: string, body: Dto<"ProposeDerogationSlotDto">) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/proposals", { params: { path: { clubSlug, requestId } }, headers: auth(clubSlug, as), body })),
};
