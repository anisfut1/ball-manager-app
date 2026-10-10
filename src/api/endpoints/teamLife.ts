import { api, auth, call } from "../client";
import type { Dto } from "../types";

/**
 * Vie d'équipe (espace public, session d'appareil). `as` = licencié au nom
 * duquel on agit (X-BM-As) : jamais un autre que ceux de la session —
 * l'API le vérifie de toute façon.
 */
export type ActionCenterDto = Dto<"ActionCenterDto">;
export type ActionCenterAction = ActionCenterDto["actions"][number];
export type PlanningDto = Dto<"PlanningDto">;
export type PlanningEvent = PlanningDto["events"][number];
export type MatchTeamLifeDto = Dto<"MatchTeamLifeDto">;
export type TrainingOccurrenceDto = Dto<"TrainingOccurrenceDto">;
export type TrainingDetailDto = Dto<"TrainingOccurrenceDetailDto">;
export type TrainingResponseValue = NonNullable<Dto<"TrainingResponseValue">>;
export type TrainingAttendanceValue = NonNullable<Dto<"TrainingAttendanceValue">>;
export type AvailabilityValue = NonNullable<Dto<"MatchAvailabilityValue">>;
export type ConvocationPreviewDto = Dto<"ConvocationPreviewDto">;
export type PutConvocationDraftDto = Dto<"PutConvocationDraftDto">;
export type TeamOverviewDto = Dto<"TeamOverviewDto">;
export type TrainingSeriesDto = Dto<"TrainingSeriesDto">;
export type CreateTrainingSeriesDto = Dto<"CreateTrainingSeriesDto">;
export type LaundrySuggestionsDto = Dto<"LaundrySuggestionsDto">;
export type PublicMeDto = Dto<"PublicMeDto">;
export type TeamDto = Dto<"TeamDto">;
export type MatchDetailsDto = Dto<"MatchDetailsDto">;

const p = (clubSlug: string) => ({ path: { clubSlug } });
/** Personnes de la session pour l'action center / le planning : `as:<licencieId>`. */
const asTokens = (licencieIds: readonly string[]) => licencieIds.map((id) => `as:${id}`);

export const teamLifeApi = {
  actionCenter: (clubSlug: string, people: readonly string[]) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/action-center", { params: p(clubSlug), headers: auth(clubSlug), body: { tokens: asTokens(people) } })),

  planning: (clubSlug: string, people: readonly string[], from: string, to: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/planning", { params: { path: { clubSlug }, query: { from, to } }, headers: auth(clubSlug), body: { tokens: asTokens(people) } })),

  me: (clubSlug: string, as: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/me", { params: p(clubSlug), headers: auth(clubSlug, as) })),
  teams: (clubSlug: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/teams", { params: p(clubSlug) })),
  matchDetails: (clubSlug: string, matchId: string) => call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/matches/{matchId}", { params: { path: { clubSlug, matchId } } })),

  // ─── Réponses (parent / joueur) ────────────────────────────────────────────
  respondTraining: (clubSlug: string, as: string, occurrenceId: string, response: TrainingResponseValue) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}/response", { params: { path: { clubSlug, occurrenceId } }, headers: auth(clubSlug, as), body: { response } })),
  respondAvailability: (clubSlug: string, as: string, matchId: string, response: AvailabilityValue) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/availability/response", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as), body: { response } })),
  respondConvocation: (clubSlug: string, as: string, matchId: string, response: "CONFIRMED" | "DECLINED") =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/convocation/response", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as), body: { response } })),
  laundrySeen: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/laundry/seen", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),

  // ─── Coach : match ─────────────────────────────────────────────────────────
  matchTeamLife: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),
  openAvailability: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/availability/open", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),
  remind: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/remind", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),
  saveDraft: (clubSlug: string, as: string, matchId: string, body: PutConvocationDraftDto) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/convocation/draft", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as), body })),
  preview: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/convocation/preview", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),
  send: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/convocation/send", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),

  // ─── Coach : maillots ──────────────────────────────────────────────────────
  laundrySuggestions: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/laundry/suggestions", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),
  assignLaundry: (clubSlug: string, as: string, matchId: string, licencieId: string) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/laundry", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as), body: { licencieId } })),
  removeLaundry: (clubSlug: string, as: string, matchId: string) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/team-life/matches/{matchId}/laundry", { params: { path: { clubSlug, matchId } }, headers: auth(clubSlug, as) })),

  // ─── Entraînements ─────────────────────────────────────────────────────────
  training: (clubSlug: string, as: string, occurrenceId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}", { params: { path: { clubSlug, occurrenceId } }, headers: auth(clubSlug, as) })),
  teamTrainings: (clubSlug: string, as: string, teamId: string, from: string, to: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/teams/{teamId}/trainings", { params: { path: { clubSlug, teamId }, query: { from, to } }, headers: auth(clubSlug, as) })),
  series: (clubSlug: string, as: string, teamId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/teams/{teamId}/training-series", { params: { path: { clubSlug, teamId } }, headers: auth(clubSlug, as) })),
  createSeries: (clubSlug: string, as: string, teamId: string, body: CreateTrainingSeriesDto) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/teams/{teamId}/training-series", { params: { path: { clubSlug, teamId } }, headers: auth(clubSlug, as), body })),
  stopSeries: (clubSlug: string, as: string, seriesId: string, from?: string) =>
    call(clubSlug, () => api().DELETE("/v1/public/clubs/{clubSlug}/team-life/training-series/{seriesId}", { params: { path: { clubSlug, seriesId }, query: from ? { from } : {} }, headers: auth(clubSlug, as) })),
  updateTraining: (clubSlug: string, as: string, occurrenceId: string, body: Dto<"UpdateTrainingOccurrenceDto">) =>
    call(clubSlug, () => api().PATCH("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}", { params: { path: { clubSlug, occurrenceId } }, headers: auth(clubSlug, as), body })),
  cancelTraining: (clubSlug: string, as: string, occurrenceId: string, reason: string | null) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}/cancel", { params: { path: { clubSlug, occurrenceId } }, headers: auth(clubSlug, as), body: { reason } })),
  restoreTraining: (clubSlug: string, as: string, occurrenceId: string) =>
    call(clubSlug, () => api().POST("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}/restore", { params: { path: { clubSlug, occurrenceId } }, headers: auth(clubSlug, as) })),
  markAttendance: (clubSlug: string, as: string, occurrenceId: string, licencieId: string, status: TrainingAttendanceValue) =>
    call(clubSlug, () => api().PUT("/v1/public/clubs/{clubSlug}/team-life/trainings/{occurrenceId}/attendance/{licencieId}", { params: { path: { clubSlug, occurrenceId, licencieId } }, headers: auth(clubSlug, as), body: { status } })),

  // ─── Équipe ────────────────────────────────────────────────────────────────
  teamOverview: (clubSlug: string, as: string, teamId: string) =>
    call(clubSlug, () => api().GET("/v1/public/clubs/{clubSlug}/team-life/teams/{teamId}/overview", { params: { path: { clubSlug, teamId } }, headers: auth(clubSlug, as) })),
};
