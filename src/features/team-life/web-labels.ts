import type { TrainingSeriesDto } from "@/api/endpoints/teamLife";
import { formatTime } from "@/lib/dates";

/**
 * Libellés de la Vie d'équipe COPIÉS du web (SCSB
 * `src/features/team-life/labels.ts`) : mêmes mots, mêmes formats, fuseau
 * du club (jamais celui du téléphone). Tests recopiés à l'identique.
 */

/** 0 = dimanche … 6 = samedi (même convention que l'API). */
export const WEEKDAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
/** Ordre d'affichage d'une semaine de club : lundi d'abord. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function fmt(iso: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: timezone, ...options });
}

/** « 19:00 » */
export function timeOf(iso: string, timezone: string): string {
  // Même sortie que le web, via le formateur de l'app (formatToParts : fiable sous Hermes).
  return formatTime(iso, timezone);
}

/** « mardi 14 oct. » */
export function dayOf(iso: string, timezone: string): string {
  return fmt(iso, timezone, { weekday: "long", day: "numeric", month: "short" });
}

/** « mardi » (aujourd'hui / demain quand c'est le cas). */
export function relativeDay(iso: string, timezone: string, now: Date = new Date()): string {
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const target = key(new Date(iso));
  if (target === key(now)) return "aujourd'hui";
  if (target === key(new Date(now.getTime() + 86_400_000))) return "demain";
  return fmt(iso, timezone, { weekday: "long", day: "numeric", month: "short" });
}

/** « Mardi 19:00–20:30 » d'un créneau récurrent. */
export function seriesLabel(series: Pick<TrainingSeriesDto, "weekday" | "startTime" | "endTime">): string {
  return `${WEEKDAY_NAMES[series.weekday]} ${series.startTime}–${series.endTime}`;
}

export function locationLabel(location: { label: string | null; address: string | null }): string | null {
  return location.label ?? location.address ?? null;
}

/** « 30 juin 2027 » depuis « 2027-06-30 ». */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Fin de saison (30 juin) de la saison qui contient `todayKey` (saison d'août à juin). */
export function seasonEndKey(todayKey: string): string {
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  return `${m >= 7 ? y + 1 : y}-06-30`;
}

/** « 18 présents · 2 absents · 1 incertain · 4 sans réponse » (les zéros sont omis, sauf tout à zéro). */
export function countsSummary(counts: { present: number; absent: number; uncertain: number; noResponse: number }): string {
  const parts = [
    counts.present ? `${counts.present} présent${counts.present > 1 ? "s" : ""}` : null,
    counts.absent ? `${counts.absent} absent${counts.absent > 1 ? "s" : ""}` : null,
    counts.uncertain ? `${counts.uncertain} incertain${counts.uncertain > 1 ? "s" : ""}` : null,
    counts.noResponse ? `${counts.noResponse} sans réponse` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Aucun joueur dans l'effectif";
}

/** « U15 (F) » — même règle que ball-manager-back (`formatTeamNameWithGender`). */
export function teamDisplayName(team: { name: string; sexe: "M" | "F" | null }): string {
  if (team.sexe !== "M" && team.sexe !== "F") return team.name;
  if (new RegExp(`(^|\\s)${team.sexe}$`).test(team.name.trim())) return team.name;
  return `${team.name} (${team.sexe})`;
}

/** « Sam. 10 oct. · 18:00 » ; date inconnue : « Date à confirmer ». */
export function shortDateTime(iso: string | null, timezone: string): string {
  if (!iso) return "Date à confirmer";
  const day = new Date(iso).toLocaleDateString("fr-FR", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${timeOf(iso, timezone)}`;
}

/** « 10 convoqués · 7 confirmés · 1 refus · 2 en attente ». */
export function convocationSummary(c: { convoked: number; confirmed: number; declined: number; pending: number }): string {
  return [`${c.convoked} convoqué${c.convoked > 1 ? "s" : ""}`, c.confirmed ? `${c.confirmed} confirmé${c.confirmed > 1 ? "s" : ""}` : null, c.declined ? `${c.declined} refus` : null, c.pending ? `${c.pending} en attente` : null]
    .filter(Boolean)
    .join(" · ");
}

/** « 2 absences · 1 retard » ; « Toujours là » si rien n'a été noté sur les séances relevées (page Équipe du web). */
export function attendanceLabel(a: { absent: number; late: number }): string {
  const parts = [a.absent ? `${a.absent} absence${a.absent > 1 ? "s" : ""}` : null, a.late ? `${a.late} retard${a.late > 1 ? "s" : ""}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Toujours là";
}

/** Séances passées (page Entraînements du web) : « 2 absents · 1 retard », « Tout le monde présent » ou « Présence non relevée ». */
export function attendanceText(a: { recorded: boolean; absent: number; late: number } | null | undefined): string {
  if (!a || !a.recorded) return "Présence non relevée";
  const parts = [a.absent ? `${a.absent} absent${a.absent > 1 ? "s" : ""}` : null, a.late ? `${a.late} retard${a.late > 1 ? "s" : ""}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Tout le monde présent";
}

/** Lundi (« AAAA-MM-JJ ») de la semaine qui contient `dateKey` (PlanningView du web). */
export function mondayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** Équipes des personnes de l'appareil, équipes coachées d'abord (PublicTeamsApp du web). */
export interface MyTeam {
  id: string;
  name: string;
  coach: boolean;
  /** Prénoms concernés sur l'appareil (« Lina, Hugo »). */
  who: string[];
}

export function collectTeams(homes: { licencie: { firstName: string }; teams: { id: string; name: string; relation: string }[] }[]): MyTeam[] {
  const byId = new Map<string, MyTeam>();
  for (const home of homes) {
    for (const t of home.teams) {
      const current = byId.get(t.id) ?? { id: t.id, name: t.name, coach: false, who: [] };
      if (t.relation === "COACH") current.coach = true;
      if (!current.who.includes(home.licencie.firstName)) current.who.push(home.licencie.firstName);
      byId.set(t.id, current);
    }
  }
  return [...byId.values()].sort((a, b) => Number(b.coach) - Number(a.coach) || a.name.localeCompare(b.name, "fr", { numeric: true }));
}
