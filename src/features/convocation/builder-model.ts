import type { MatchTeamLifeDto } from "@/api/endpoints/teamLife";
import { dayKey, formatTime, zonedToUtcIso } from "@/lib/dates";

/**
 * Assistant de convocation (coach) — logique PURE, testée :
 * sélection → heure de RDV → lieu de RDV → message → aperçu → envoi.
 * À l'extérieur, le lieu de RDV (parking, gymnase du club…) est DISTINCT du
 * lieu du match et obligatoire ; le serveur le vérifie aussi (blockers).
 */
export interface Draft {
  licencieIds: string[];
  meetingTime: string | null; // HH:MM, heure du club
  meetingPoint: string;
  coachMessage: string;
}

export function initialDraft(data: MatchTeamLifeDto, tz: string): Draft {
  const d = data.convocation?.draft;
  const fromDraft = d?.licencieIds ?? [];
  const available = data.availability.roster.filter((r) => r.response === "AVAILABLE").map((r) => r.licencie.id);
  return {
    licencieIds: fromDraft.length ? fromDraft : available,
    meetingTime: d?.meetingAt ? formatTime(d.meetingAt, tz) : null,
    meetingPoint: d?.meetingPoint ?? (data.match.isHome !== false ? (data.match.venueName ?? "") : ""),
    coachMessage: d?.coachMessage ?? "",
  };
}

/** Heures de RDV proposées : 1 h 30, 1 h 15, 1 h et 45 min avant le match. */
export function meetingPresets(matchStartsAt: string | null, tz: string): { label: string; time: string }[] {
  if (!matchStartsAt) return [];
  const start = new Date(matchStartsAt).getTime();
  return [90, 75, 60, 45].map((min) => ({ label: min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""} avant` : `${min} min avant`, time: formatTime(new Date(start - min * 60_000).toISOString(), tz) }));
}

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validate(draft: Draft, data: MatchTeamLifeDto): string[] {
  const problems: string[] = [];
  if (draft.licencieIds.length === 0) problems.push("Sélectionne au moins un joueur.");
  if (!draft.meetingTime || !TIME.test(draft.meetingTime)) problems.push("Indique l'heure du rendez-vous (HH:MM).");
  if (data.match.isHome === false && !draft.meetingPoint.trim()) problems.push("Match à l'extérieur : indique le lieu du rendez-vous (il n'est pas le gymnase du match).");
  return problems;
}

/** Corps du brouillon envoyé à l'API (PUT …/convocation/draft). */
export function toDraftBody(draft: Draft, data: MatchTeamLifeDto, tz: string) {
  const matchDay = data.match.startsAt ? dayKey(data.match.startsAt, tz) : null;
  return {
    licencieIds: draft.licencieIds,
    meetingAt: matchDay && draft.meetingTime && TIME.test(draft.meetingTime) ? zonedToUtcIso(matchDay, draft.meetingTime, tz) : null,
    meetingPoint: draft.meetingPoint.trim() || null,
    coachMessage: draft.coachMessage.trim() || null,
  };
}

export function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
