// Repris tel quel de ball-manager-web (src/features/matches/match-filters.ts) : mêmes filtres, mêmes journées.
import type { MatchListItem as MatchListItemDto } from "@/api/endpoints/clubSpace";
import type { TeamDto } from "@/api/endpoints/teamLife";
import { currentOrNextWeekendSaturday, formatWeekendLabel } from "@/lib/weekend";

/**
 * Filtres de la liste des matchs, partagés entre la vue club
 * (`/c/{slug}/matchs`) et la vue publique (`/public/{slug}/matchs`) —
 * logique inchangée, seulement dédupliquée (elle était copiée dans les deux
 * pages). L'état vit dans l'URL : partageable, compatible retour arrière.
 */
export type WhenFilter = "weekend" | "upcoming" | "past";
export type SideFilter = "all" | "home" | "away";

export interface MatchFiltersState {
  when: WhenFilter;
  side: SideFilter;
  team: string | null;
  /**
   * Journée choisie (samedi YYYY-MM-DD) quand `when === "weekend"` — `null` =
   * la journée en cours/à venir. Retour du club, 2026-10-01 : « faut un
   * sélecteur en haut pour choisir sa journée, ou sa semaine ».
   */
  weekend: string | null;
}

export const WHEN_OPTIONS: { value: WhenFilter; label: string }[] = [
  { value: "weekend", label: "Journée" },
  { value: "upcoming", label: "À venir" },
  { value: "past", label: "Passés" },
];

export const SIDE_OPTIONS: { value: SideFilter; label: string }[] = [
  { value: "all", label: "Tous les lieux" },
  { value: "home", label: "Domicile" },
  { value: "away", label: "Extérieur" },
];

export function parseMatchFilters(searchParams: Record<string, string | string[] | undefined>): MatchFiltersState {
  const when: WhenFilter = searchParams.when === "upcoming" || searchParams.when === "past" ? searchParams.when : "weekend";
  const side: SideFilter = searchParams.side === "home" || searchParams.side === "away" ? searchParams.side : "all";
  const team = typeof searchParams.team === "string" ? searchParams.team : null;
  const weekend = when === "weekend" && typeof searchParams.weekend === "string" && isSaturday(searchParams.weekend) ? searchParams.weekend : null;
  return { when, side, team, weekend };
}

function isSaturday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDay() === 6;
}

/**
 * Journée (week-end) d'un match : le samedi du week-end qui le contient, ou
 * qui le suit pour un match en semaine — même règle que les Tables de marque.
 */
export function matchWeekendKey(matchDatetime: string): string {
  return currentOrNextWeekendSaturday("Europe/Paris", new Date(matchDatetime));
}

/** Journée par défaut : celle en cours (samedi/dimanche) ou la prochaine. */
export function defaultWeekend(now: Date = new Date()): string {
  return currentOrNextWeekendSaturday("Europe/Paris", now);
}

export function buildFilterHref(basePath: string, current: MatchFiltersState, changes: Partial<MatchFiltersState>): string {
  const next = { ...current, ...changes };
  const search = new URLSearchParams();
  if (next.when !== "weekend") search.set("when", next.when);
  if (next.when === "weekend" && next.weekend) search.set("weekend", next.weekend);
  if (next.side !== "all") search.set("side", next.side);
  if (next.team) search.set("team", next.team);
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function applyMatchFilters(all: MatchListItemDto[], teams: TeamDto[], filters: MatchFiltersState, now: Date = new Date()): MatchListItemDto[] {
  let matches = all;
  if (filters.team) {
    const teamName = teams.find((t) => t.id === filters.team)?.name ?? null;
    matches = teamName ? matches.filter((m) => m.teamName === teamName) : matches;
  }
  if (filters.side !== "all") matches = matches.filter((m) => m.isHome === (filters.side === "home"));

  if (filters.when === "weekend") {
    const saturday = filters.weekend ?? defaultWeekend(now);
    matches = matches.filter((m) => m.matchDatetime !== null && matchWeekendKey(m.matchDatetime) === saturday);
  } else if (filters.when === "upcoming") {
    matches = matches.filter((m) => m.matchDatetime !== null && new Date(m.matchDatetime) >= now);
  } else {
    matches = matches.filter((m) => m.matchDatetime !== null && new Date(m.matchDatetime) < now);
  }

  return [...matches].sort((a, b) => {
    const aTime = a.matchDatetime ? new Date(a.matchDatetime).getTime() : 0;
    const bTime = b.matchDatetime ? new Date(b.matchDatetime).getTime() : 0;
    return filters.when === "past" ? bTime - aTime : aTime - bTime;
  });
}

export interface WeekendGroup {
  /** Samedi de la journée (YYYY-MM-DD, Europe/Paris) — clé stable. */
  saturday: string;
  label: string;
  matches: MatchListItemDto[];
}

/**
 * Regroupe par journée de championnat = week-end (retour du club,
 * 2026-10-01 : « dans match faut mettre par weekend (par journée), là c tout
 * mélangé dans À venir »). Un match en semaine est rattaché au week-end qui
 * suit (même règle que les Tables de marque, `currentOrNextWeekendSaturday`).
 * Conserve l'ordre reçu (croissant pour « À venir », décroissant pour
 * « Passés ») ; les matchs sans date restent dans un groupe final.
 */
export function groupMatchesByWeekend(matches: MatchListItemDto[]): WeekendGroup[] {
  const groups = new Map<string, WeekendGroup>();
  const undated: MatchListItemDto[] = [];
  for (const match of matches) {
    if (!match.matchDatetime) {
      undated.push(match);
      continue;
    }
    const saturday = matchWeekendKey(match.matchDatetime);
    const group = groups.get(saturday) ?? { saturday, label: formatWeekendLabel(saturday), matches: [] };
    group.matches.push(match);
    groups.set(saturday, group);
  }
  const result = [...groups.values()];
  if (undated.length > 0) result.push({ saturday: "undated", label: "Date à confirmer", matches: undated });
  return result;
}

export interface WeekendOption {
  saturday: string;
  label: string;
  count: number;
}

/**
 * Journées de la saison qui ont au moins un match (après filtres équipe/lieu),
 * triées chronologiquement — alimente le sélecteur de journée. La journée
 * par défaut y figure toujours, même vide, pour rester sélectionnable.
 */
export function weekendOptions(all: MatchListItemDto[], teams: TeamDto[], filters: MatchFiltersState, now: Date = new Date()): WeekendOption[] {
  const scoped = applyMatchFilters(all, teams, { ...filters, when: "upcoming" }, new Date(0));
  const counts = new Map<string, number>();
  for (const m of scoped) {
    if (!m.matchDatetime) continue;
    const key = matchWeekendKey(m.matchDatetime);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const current = defaultWeekend(now);
  if (!counts.has(current)) counts.set(current, 0);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([saturday, count]) => ({ saturday, label: formatWeekendLabel(saturday), count }));
}
