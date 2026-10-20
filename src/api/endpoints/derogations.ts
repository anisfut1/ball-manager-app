import { api, auth, call, fbiWriteApi } from "../client";
import type { Dto } from "../types";

export type DerogationContextDto = Dto<"DerogationContextDto">;
export type DerogationSummary = Dto<"DerogationRequestSummaryDto">;
export type DerogationDetail = Dto<"DerogationRequestDetailDto">;
export type DerogationAction = Dto<"DerogationAction">;
export type DerogationStatus = Dto<"DerogationRequestStatus">;
export type DerogationMatchRef = Dto<"DerogationMatchRefDto">;
export type ClubVenue = Dto<"ClubVenueDto">;
export type DerogationAvailability = Dto<"DerogationAvailabilityDto">;
export type CandidateSlot = Dto<"CandidateSlotDto">;
export type OfficialDerogation = Dto<"DerogationListItemDto">;
export type CreateOfficialDerogationBody = Dto<"CreateDerogationDto">;
export type OfficialOutcome = Dto<"CreateDerogationResultDto">;

const req = (clubSlug: string, requestId: string) => ({ path: { clubSlug, requestId } });

/**
 * Dérogations, mêmes appels que l'espace public du web :
 *  - demandes INTERNES (coach → coordinateur) ;
 *  - dérogations OFFICIELLES FBI (admin du club ou coordinateur) : liste,
 *    accepter / refuser, créer. Ces écritures partent réellement sur FBI,
 *    toujours après une confirmation explicite à l'écran.
 */
export const derogationsApi = {
  context: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/context", { params: { path: { clubSlug } }, headers: auth(clubSlug, as) })),
  list: (clubSlug: string, as: string, matchId?: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests", { params: { path: { clubSlug }, query: matchId ? { matchId, limit: 5 } : { limit: 200 } }, headers: auth(clubSlug, as) })),
  detail: (clubSlug: string, as: string, requestId: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}", { params: req(clubSlug, requestId), headers: auth(clubSlug, as) })),
  create: (clubSlug: string, as: string, body: Dto<"CreateDerogationRequestDto">) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests", { params: { path: { clubSlug } }, headers: auth(clubSlug, as), body })),
  message: (clubSlug: string, as: string, requestId: string, message: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/messages", { params: req(clubSlug, requestId), headers: auth(clubSlug, as), body: { message } })),
  action: (clubSlug: string, as: string, requestId: string, action: DerogationAction, message?: string | null) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/actions", { params: req(clubSlug, requestId), headers: auth(clubSlug, as), body: { action, message: message || null } })),
  propose: (clubSlug: string, as: string, requestId: string, body: Dto<"ProposeDerogationSlotDto">) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/proposals", { params: req(clubSlug, requestId), headers: auth(clubSlug, as), body })),
  remove: (clubSlug: string, as: string, requestId: string) => call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}", { params: req(clubSlug, requestId), headers: auth(clubSlug, as) })),
  availability: (clubSlug: string, as: string, matchId: string, date: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/availability", { params: { path: { clubSlug }, query: { matchId, date } }, headers: auth(clubSlug, as) })),
  checkSlot: (clubSlug: string, as: string, matchId: string, startAt: string, venueId: string | null) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogation-requests/slot-check", { params: { path: { clubSlug }, query: venueId ? { matchId, startAt, venueId } : { matchId, startAt } }, headers: auth(clubSlug, as) })),
  /** Demande officielle FBI depuis une demande interne (coordinateur). Écrit sur FBI. */
  official: (clubSlug: string, as: string, requestId: string, body: CreateOfficialDerogationBody) =>
    call(clubSlug, () => fbiWriteApi().POST("/v1/public/clubs/{clubSlug}/derogation-requests/{requestId}/official", { params: req(clubSlug, requestId), headers: auth(clubSlug, as), body })),

  // ─── Dérogations officielles FBI (admin du club / coordinateur) ────────────
  officialList: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/derogations", { params: { path: { clubSlug } }, headers: auth(clubSlug, as) })),
  /** Accepter / refuser sur FBI. Écrit sur FBI. */
  respond: (clubSlug: string, as: string, derogationId: string, body: Dto<"RespondToDerogationDto">) =>
    call(clubSlug, () => fbiWriteApi().POST("/v1/public/clubs/{clubSlug}/derogations/{derogationId}/respond", { params: { path: { clubSlug, derogationId } }, headers: auth(clubSlug, as), body })),
  /** Créer une dérogation FBI depuis la fiche match. Écrit sur FBI. */
  createOfficial: (clubSlug: string, as: string, matchId: string, body: CreateOfficialDerogationBody) =>
    call(clubSlug, () => fbiWriteApi().POST("/v1/public/clubs/{clubSlug}/matches/{matchId}/derogation/create", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as), body })),
};
