import type { HomeRelation, PublicHomeDto } from "@/api/endpoints/clubSpace";
import type { ActionCenterDto } from "@/api/endpoints/teamLife";

/**
 * « Mon agenda » de l'accueil, même règle que ball-manager-web
 * (src/features/team-life/agenda.ts) : les matchs de l'accueil (carte riche)
 * + les entraînements et les matchs des autres personnes de l'appareil, en
 * une seule liste chronologique, sans doublon.
 */
export type AgendaItem =
  | { kind: "MATCH"; key: string; at: string | null; entry: PublicHomeDto["upcoming"][number] }
  | { kind: "EVENT"; key: string; at: string; event: ActionCenterDto["upcoming"][number]; relations: HomeRelation[]; forFirstNames: string[] };

export function buildAgenda(home: Pick<PublicHomeDto, "upcoming">, center: Pick<ActionCenterDto, "people" | "upcoming"> | null | undefined): AgendaItem[] {
  const items: AgendaItem[] = home.upcoming.map((entry) => ({ kind: "MATCH", key: `m-${entry.match.id}`, at: entry.match.matchDatetime, entry }));
  if (center) {
    const knownMatches = new Set(home.upcoming.map((e) => e.match.id));
    for (const event of center.upcoming) {
      if (event.kind === "MATCH" && knownMatches.has(event.id)) continue;
      const teamId = event.team?.id;
      const relations: HomeRelation[] = [];
      if (teamId && center.people.some((p) => p.coachTeams.some((t) => t.id === teamId))) relations.push("COACH");
      if (teamId && center.people.some((p) => p.team?.id === teamId)) relations.push("PLAYER");
      items.push({ kind: "EVENT", key: `${event.kind}-${event.id}`, at: event.startsAt, event, relations, forFirstNames: event.forFirstNames });
    }
  }
  return items.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : b.at ? 1 : 0));
}
