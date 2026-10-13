import type { MatchListItem } from "@/api/endpoints/clubSpace";
import { dayKey, formatLongDay, formatTime } from "@/lib/dates";

/**
 * Règles d'affichage d'un match, reprises de ball-manager-web
 * (src/features/matches/match-display.tsx) : mêmes libellés, mêmes cas.
 * Le basket français se joue en France : heures toujours en Europe/Paris.
 */
export const MATCH_TZ = "Europe/Paris";

export interface MatchSide {
  name: string;
  /** Nom servant au monogramme (le club plutôt que le libellé d'équipe). */
  logoName: string;
  logoUrl: string | null;
  score: number | null;
  isClub: boolean;
}

/** Libellé du côté club : l'équipe si connue, sinon « Club · catégorie ». Jamais une équipe devinée. */
export function clubSideLabel(match: Pick<MatchListItem, "teamName" | "categoryLabel">, clubName: string): string {
  if (match.teamName) return match.teamName;
  return match.categoryLabel ? `${clubName} · ${match.categoryLabel}` : clubName;
}

/** Ordre FFBB : domicile d'abord ; côté inconnu : le club d'abord. */
export function matchSides(match: MatchListItem, club: { name: string; logoUrl: string | null }): [MatchSide, MatchSide] {
  const ours: MatchSide = { name: clubSideLabel(match, club.name), logoName: club.name, logoUrl: club.logoUrl, score: null, isClub: true };
  const theirs: MatchSide = { name: match.opponentName ?? "Adversaire à confirmer", logoName: match.opponentName ?? "?", logoUrl: match.opponentLogoUrl, score: null, isClub: false };
  const [home, away] = match.isHome === false ? [theirs, ours] : [ours, theirs];
  return [
    { ...home, score: match.scoreHome },
    { ...away, score: match.scoreAway },
  ];
}

export function isPlayed(match: Pick<MatchListItem, "scoreHome" | "scoreAway">): boolean {
  return match.scoreHome !== null && match.scoreAway !== null;
}

/** Issue pour le club, `null` si score ou côté inconnu. */
export function matchOutcome(match: Pick<MatchListItem, "scoreHome" | "scoreAway" | "isHome">): "win" | "loss" | "draw" | null {
  if (match.scoreHome === null || match.scoreAway === null || match.isHome === null) return null;
  const ours = match.isHome ? match.scoreHome : match.scoreAway;
  const theirs = match.isHome ? match.scoreAway : match.scoreHome;
  return ours > theirs ? "win" : ours < theirs ? "loss" : "draw";
}

/** Statut exceptionnel (reporté, annulé, forfait), `null` pour un match normal. */
export function matchStatusLabel(status: MatchListItem["status"]): { label: string; tone: "warning" | "danger" } | null {
  if (status === "postponed") return { label: "Reporté", tone: "warning" };
  if (status === "cancelled") return { label: "Annulé", tone: "danger" };
  if (status === "forfeit") return { label: "Forfait", tone: "danger" };
  return null;
}

/** « 5 » → « Journée 5 ». */
export function journeeLabel(journee: string | null): string | null {
  if (!journee) return null;
  return /^\d+$/.test(journee.trim()) ? `Journée ${journee.trim()}` : journee;
}

/** Ligne de compétition : « Journée 5 · Régionale 2 », sinon le numéro de rencontre. */
export function competitionLine(match: Pick<MatchListItem, "journee" | "competitionName" | "numero">): string {
  return [journeeLabel(match.journee), match.competitionName].filter(Boolean).join(" · ") || (match.numero ? `Rencontre n° ${match.numero}` : "Championnat");
}

export function matchTime(match: Pick<MatchListItem, "matchDatetime">): string | null {
  return match.matchDatetime ? formatTime(match.matchDatetime, MATCH_TZ) : null;
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Un en-tête par jour (jamais la même date répétée) ; les éléments sans date à la fin (« Date à confirmer »). */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => string | null, tz: string = MATCH_TZ): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const iso = dateOf(item);
    const key = iso ? dayKey(iso, tz) : "unknown";
    let group = groups.get(key);
    if (!group) {
      const label = iso ? formatLongDay(iso, tz) : "Date à confirmer";
      group = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.key !== "unknown"), ...all.filter((g) => g.key === "unknown")];
}
