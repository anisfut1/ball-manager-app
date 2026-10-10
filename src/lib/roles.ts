import type { ActionCenterDto, PublicMeDto } from "@/api/endpoints/teamLife";

/**
 * Rôles FUSIONNÉS des personnes de l'appareil (parent, joueur, coach,
 * responsable tables, coordinateur, admin du club) — jamais de « choisis
 * ton mode ». L'interface montre ce que l'API autorise ; l'API reste juge.
 */
export interface MergedRoles {
  /** Équipes coachées par au moins une personne de l'appareil. */
  coachTeams: { id: string; name: string; coachLicencieId: string }[];
  /** Équipes jouées (parent / joueur). */
  memberTeams: { id: string; name: string; licencieId: string }[];
  isCoach: boolean;
  isClubAdmin: boolean;
  canManageTables: boolean;
  canCreateDerogations: boolean;
  canManageDerogations: boolean;
  /** Personne à utiliser (X-BM-As) pour agir en coach sur une équipe. */
  coachFor(teamId: string): string | null;
  /** Personne qui a le droit « tables » ou « dérogations ». */
  actorFor(capability: "tables" | "derogations" | "derogations-create"): string | null;
}

export function mergeRoles(people: ActionCenterDto["people"], me: Record<string, PublicMeDto | undefined>): MergedRoles {
  const coachTeams = new Map<string, { id: string; name: string; coachLicencieId: string }>();
  const memberTeams = new Map<string, { id: string; name: string; licencieId: string }>();
  for (const person of people) {
    if (person.team && !memberTeams.has(person.team.id)) memberTeams.set(person.team.id, { ...person.team, licencieId: person.licencieId });
    for (const t of person.coachTeams) if (!coachTeams.has(t.id)) coachTeams.set(t.id, { ...t, coachLicencieId: person.licencieId });
  }
  const ids = people.map((p) => p.licencieId);
  const find = (pred: (m: PublicMeDto) => boolean) => ids.find((id) => me[id] && pred(me[id]!)) ?? null;
  const adminId = find((m) => m.isClubAdmin);
  return {
    coachTeams: [...coachTeams.values()],
    memberTeams: [...memberTeams.values()],
    isCoach: coachTeams.size > 0,
    isClubAdmin: adminId !== null,
    canManageTables: find((m) => m.tables.canManage) !== null,
    canCreateDerogations: find((m) => m.derogationRequests.canCreate) !== null,
    canManageDerogations: find((m) => m.derogationRequests.canManage) !== null,
    coachFor: (teamId) => coachTeams.get(teamId)?.coachLicencieId ?? adminId,
    actorFor: (capability) =>
      capability === "tables" ? find((m) => m.tables.canManage) : capability === "derogations" ? (find((m) => m.derogationRequests.canManage) ?? find((m) => m.derogationRequests.canCreate)) : find((m) => m.derogationRequests.canCreate),
  };
}
